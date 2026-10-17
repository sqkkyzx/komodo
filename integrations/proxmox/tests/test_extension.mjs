import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const extension = readFileSync(new URL('../static/extension.js', import.meta.url), 'utf8');
const dockerId = 'pve-komodo-docker';

function treeNode(data) {
    return {
        data: { leaf: true, expanded: false, ...data },
        childNodes: [],
        parentNode: null,
        findChild(field, value) {
            return this.childNodes.find((node) => node.data[field] === value) || null;
        },
        appendChild(child) {
            child.parentNode = this;
            this.childNodes.push(child);
            // Ext.data.NodeInterface.appendChild changes a leaf into a parent.
            this.data.leaf = false;
        },
    };
}

// Model ExtJS's per-method owner/previous metadata, not a global callParent stub.
// That catches a change which accidentally calls the subclass's parent twice or
// loses `this` when overriding an inherited method.
function createExt() {
    const classes = new Map();
    const stack = [];
    let definitions = 0;

    function wrap(owner, name, implementation, previous) {
        return function (...args) {
            stack.push({ owner, name, previous, receiver: this });
            try {
                return implementation.apply(this, args);
            } finally {
                stack.pop();
            }
        };
    }

    function define(name, definition) {
        definitions++;
        if (definition.override) {
            const target = classes.get(definition.override);
            for (const [method, implementation] of Object.entries(definition)) {
                if (typeof implementation === 'function') {
                    const previous = Object.hasOwn(target.prototype, method) ?
                        target.prototype[method] : undefined;
                    target.prototype[method] = wrap(target, method, implementation, previous);
                }
            }
            // ExtJS createOverride applies methods without registering an ordinary
            // class under the override name in ClassManager.classes.
            return target;
        }

        const parent = definition.extend && classes.get(definition.extend);
        function Component(config = {}) {
            Object.assign(this, config);
        }
        Component.superclass = parent && parent.prototype;
        Component.prototype = Object.create(parent ? parent.prototype : null);
        Component.prototype.constructor = Component;
        Component.prototype.callParent = function (args = []) {
            const frame = stack.at(-1);
            assert.equal(frame.receiver, this, 'parent must use the same component');
            const parentMethod = frame.previous || frame.owner.superclass[frame.name];
            return parentMethod.apply(this, args);
        };
        for (const [method, implementation] of Object.entries(definition)) {
            if (typeof implementation === 'function') {
                Component.prototype[method] = wrap(Component, method, implementation);
            }
        }
        classes.set(name, Component);
        return Component;
    }

    define('Ext.panel.Panel', {
        initComponent: function () {
            this.panelInitialized = true;
            return 'panel-initialized';
        },
    });

    // Preserve the relevant PVE 9 lifecycle and grouping semantics from fixed
    // pve-manager aa7db891 dc/Config.js and panel/ConfigPanel.js. Groups contain
    // parent itemIds, are consumed via shift(), and require parents first.
    define('PVE.panel.Config', {
        extend: 'Ext.panel.Panel',
        initComponent: function () {
            this.savedItems = {};
            this.root = treeNode({ id: 'root', expanded: true });
            this.navigation = this.root.childNodes;
            this.insertNodes(this.items);
            delete this.items;
            return this.callParent(arguments);
        },
        insertNodes: function (items) {
            this.baseInsertCalls = (this.baseInsertCalls || 0) + 1;
            if (!Array.isArray(items)) {
                return items;
            }
            for (const item of items) {
                assert.equal(this.savedItems[item.itemId], undefined, 'PVE rejects duplicate ids');
                item.header = false;
                this.savedItems[item.itemId] = item;
                let parent = this.root;
                while (Array.isArray(item.groups) && item.groups.length > 0) {
                    const child = parent.findChild('id', item.groups.shift());
                    if (child === null) break;
                    parent = child;
                }
                assert.equal(parent.findChild('id', item.itemId), null);
                parent.appendChild(treeNode({
                    id: item.itemId, text: item.title, iconCls: item.iconCls,
                    expanded: item.expandedOnInit === true,
                }));
            }
            return items;
        },
        activateCard: function (id) {
            this.activeCard = this.savedItems[id];
            if (this.activeCard.listeners?.activate) {
                this.activeCard.listeners.activate(this.activeCard);
            }
            return this.activeCard;
        },
    });

    for (const [name, originalId] of [
        ['PVE.dc.Config', 'summary'],
        ['PVE.qemu.Config', 'hardware'],
        ['PVE.lxc.Config', 'resources'],
    ]) {
        define(name, {
            extend: 'PVE.panel.Config',
            initComponent: function () {
                this.items = this.sourceItems || [{ xtype: 'panel', itemId: originalId, title: originalId }];
                this.originalItems = this.items.slice();
                return this.callParent(arguments);
            },
        });
    }

    return {
        Ajax: { request() { assert.fail('blank pages must not make requests'); } },
        ClassManager: { get: (name) => classes.get(name) },
        define,
        get definitions() { return definitions; },
        create(name, config) {
            const component = new (classes.get(name))(config);
            component.initializationResult = component.initComponent();
            return component;
        },
    };
}

function runtime(Ext = createExt()) {
    const warnings = [];
    const forbiddenRequest = () => { throw new Error('blank pages must not make requests'); };
    const context = vm.createContext({
        window: { Ext, console: { warn: (...args) => warnings.push(args) } },
        fetch: forbiddenRequest,
        XMLHttpRequest: forbiddenRequest,
    });
    return { Ext, warnings, load: () => vm.runInContext(extension, context) };
}

function datacenterItems() {
    return [
        { xtype: 'panel', itemId: 'summary', title: 'Summary' },
        { xtype: 'panel', itemId: 'ceph', title: 'Ceph' },
        { xtype: 'panel', itemId: 'options', title: 'Options' },
        { xtype: 'panel', itemId: 'permissions', title: 'Permissions', expandedOnInit: true },
        { xtype: 'panel', itemId: 'users', title: 'Users', groups: ['permissions'] },
    ];
}

const children = [
    ['stats', '统计', '/stats'], ['servers', '服务器', '/servers'],
    ['stacks', '应用', '/stacks'], ['alerts', '告警', '/alerts'],
    ['updates', '操作', '/updates'], ['schedules', '计划任务', '/schedules'],
];
const menuIds = (nodes) => nodes.map((node) => node.data.id);

function assertBlank(card) {
    assert.equal(card.xtype, 'panel');
    assert.equal(card.header, false);
    assert.equal(card.border, false);
    assert.equal(card.items.length, 0);
    for (const property of ['html', 'loader', 'listeners', 'tbar', 'bbar', 'dockedItems',
        'buttons', 'store', 'href', 'src', 'url', 'autoEl']) {
        assert.equal(card[property], undefined, `blank card must not have ${property}`);
    }
}

test('Docker is directly below Ceph with six ordered children and a clickable blank parent', () => {
    const browser = runtime();
    browser.load();
    const originals = datacenterItems();
    const dc = browser.Ext.create('PVE.dc.Config', { sourceItems: originals });
    assert.deepEqual(menuIds(dc.navigation), ['summary', 'ceph', dockerId, 'options', 'permissions']);
    const docker = dc.root.findChild('id', dockerId);
    assert.equal(docker.data.text, 'Docker');
    assert.equal(docker.parentNode, dc.root, 'Docker is beside Ceph, not inside it');
    assert.equal(docker.data.leaf, false, 'appending children makes the parent expandable');
    assert.equal(docker.data.expanded, true);
    assert.deepEqual(menuIds(docker.childNodes), children.map(([id]) => dockerId + '-' + id));
    assert.deepEqual(docker.childNodes.map((node) => node.data.text), children.map(([, title]) => title));
    for (const node of docker.childNodes) {
        assert.equal(node.parentNode, docker);
        assert.equal(node.data.leaf, true);
    }
    assert.equal(dc.activateCard(dockerId), dc.savedItems[dockerId], 'parent retains its own page');
    assertBlank(dc.activeCard);
    for (const [suffix] of children) {
        assertBlank(dc.activateCard(dockerId + '-' + suffix));
    }
    for (const item of originals) {
        assert.equal(dc.savedItems[item.itemId], item, 'keep official card identity');
    }
    assert.deepEqual(menuIds(dc.root.findChild('id', 'permissions').childNodes), ['users']);
    assert.equal(dc.items, undefined, 'normal PVE lifecycle still consumes items');
    assert.equal(dc.baseInsertCalls, 1);
    assert.equal(dc.panelInitialized, true);
    assert.equal(dc.initializationResult, 'panel-initialized');
});

test('every blank page records its future Komodo route without navigation or content', () => {
    const browser = runtime();
    browser.load();
    const dc = browser.Ext.create('PVE.dc.Config');
    assert.equal(dc.savedItems[dockerId].pveKomodoRoute, '/');
    for (const [suffix, title, route] of children) {
        const card = dc.savedItems[dockerId + '-' + suffix];
        assert.equal(card.title, title);
        assert.equal(card.pveKomodoRoute, route);
        assertBlank(card);
        assert.equal(card.groups.length, 0, 'PVE consumes each own groups array');
    }
});

test('when Ceph is unavailable Docker is appended without rearranging existing menus', () => {
    const browser = runtime();
    browser.load();
    const originals = datacenterItems().filter((item) => item.itemId !== 'ceph');
    const dc = browser.Ext.create('PVE.dc.Config', { sourceItems: originals });
    assert.deepEqual(menuIds(dc.navigation), ['summary', 'options', 'permissions', dockerId]);
    assert.equal(dc.root.findChild('id', dockerId).childNodes.length, 6);
});

test('VM and CT menus retain their original cards without Docker', () => {
    const browser = runtime();
    browser.load();
    for (const [name, originalId] of [['PVE.qemu.Config', 'hardware'], ['PVE.lxc.Config', 'resources']]) {
        const component = browser.Ext.create(name);
        assert.deepEqual(menuIds(component.navigation), [originalId]);
        assert.equal(component.savedItems[dockerId], undefined);
        assert.equal(component.baseInsertCalls, 1);
    }
});

test('reloading registers once and separate datacenters receive fresh group arrays and cards', () => {
    const browser = runtime();
    const definitions = browser.Ext.definitions;
    browser.load();
    browser.load();
    assert.equal(browser.Ext.definitions, definitions + 1);
    const first = browser.Ext.create('PVE.dc.Config');
    const second = browser.Ext.create('PVE.dc.Config');
    for (const dc of [first, second]) {
        assert.equal(dc.navigation.filter((node) => node.data.id === dockerId).length, 1);
        assert.equal(dc.root.findChild('id', dockerId).childNodes.length, 6);
    }
    assert.notEqual(first.savedItems[dockerId], second.savedItems[dockerId]);
    assert.notEqual(first.savedItems[dockerId + '-stats'].groups, second.savedItems[dockerId + '-stats'].groups);
});

test('an existing reserved parent or child id leaves the original menu untouched', () => {
    for (const reservedId of [dockerId, dockerId + '-stats']) {
        const browser = runtime();
        browser.load();
        const originals = datacenterItems();
        originals.push({ xtype: 'panel', itemId: reservedId, title: 'Existing extension' });
        const dc = browser.Ext.create('PVE.dc.Config', { sourceItems: originals });
        assert.deepEqual(Object.keys(dc.savedItems), originals.map((item) => item.itemId));
        assert.equal(dc.savedItems[reservedId], originals.at(-1));
    }
});

test('the override preserves parent return values and unknown inputs', () => {
    const browser = runtime();
    browser.load();
    const dc = browser.Ext.create('PVE.dc.Config');
    const unknownItems = { unknown: true };
    assert.equal(dc.insertNodes(unknownItems), unknownItems);
    assert.equal(dc.baseInsertCalls, 2);
});

test('the method works with ExtJS caller-based callParent in an ordinary browser script', () => {
    let parentReceiver;
    function Datacenter() {}
    const parentInsertNodes = function (items) {
        parentReceiver = this;
        return items;
    };
    Datacenter.prototype.insertNodes = parentInsertNodes;
    // Function() produces a non-strict function even though this test is an ESM.
    // Like Ext.Base.callParent, strict overriding callers cannot be resolved.
    Datacenter.prototype.callParent = Function('args', `
        var method = this.callParent.caller;
        if (!method) throw new Error('ExtJS cannot resolve a strict overriding caller');
        return (method.$previous || method.$owner.superclass[method.$name]).apply(this, args);
    `);
    const browser = runtime({
        ClassManager: { get: (name) => name === 'PVE.dc.Config' ? Datacenter : undefined },
        define(name, definition) {
            const method = definition.insertNodes;
            method.$owner = { superclass: { insertNodes: parentInsertNodes } };
            method.$name = 'insertNodes';
            Datacenter.prototype.insertNodes = method;
        },
    });
    browser.load();
    const dc = new Datacenter();
    const items = dc.insertNodes([{ itemId: 'summary' }]);
    assert.equal(parentReceiver, dc);
    assert.equal(items.length, 8);
    assert.equal(items[1].itemId, dockerId);
});

test('missing or changed PVE interfaces leave the original page untouched', () => {
    for (const Ext of [undefined, {}, { ClassManager: { get: () => ({}) }, define() {
        assert.fail('changed PVE constructor must not register an override');
    } }, { ClassManager: { get: () => undefined }, define() {
        assert.fail('unknown PVE must not register an override');
    } }]) {
        const browser = runtime(Ext === undefined ? null : Ext);
        assert.doesNotThrow(browser.load);
        assert.equal(browser.warnings.length, 0);
    }
});

test('ExtJS refusing registration does not prevent the PVE page from starting', () => {
    const Ext = createExt();
    Ext.define = () => { throw new Error('simulated incompatible class registry'); };
    const browser = runtime(Ext);
    assert.doesNotThrow(browser.load);
    assert.equal(browser.warnings.length, 1);
    const dc = Ext.create('PVE.dc.Config');
    assert.deepEqual(menuIds(dc.navigation), ['summary']);
});
