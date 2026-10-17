import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const extension = readFileSync(new URL('../static/extension.js', import.meta.url), 'utf8');
const dockerId = 'pve-komodo-docker';

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

    // Preserve PVE 9's relevant lifecycle: dc init replaces items; ConfigPanel
    // consumes them with insertNodes and then deletes them. These are from
    // pve-manager aa7db891 www/manager6/{dc/Config.js,panel/ConfigPanel.js}.
    define('PVE.panel.Config', {
        extend: 'Ext.panel.Panel',
        initComponent: function () {
            this.savedItems = {};
            this.navigation = [];
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
                this.navigation.push({ id: item.itemId, text: item.title });
            }
            return items;
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
                this.items = [{ xtype: 'panel', itemId: originalId, title: originalId }];
                this.originalItem = this.items[0];
                if (this.existingDocker) {
                    this.items.push(this.existingDocker);
                }
                return this.callParent(arguments);
            },
        });
    }

    return {
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
    const forbiddenRequest = () => { throw new Error('blank extension must not make requests'); };
    const context = vm.createContext({
        window: { Ext, console: { warn: (...args) => warnings.push(args) } },
        fetch: forbiddenRequest,
        XMLHttpRequest: forbiddenRequest,
    });
    return { Ext, warnings, load: () => vm.runInContext(extension, context) };
}

test('datacenter gains a native blank card after PVE initializes its original items', () => {
    const browser = runtime();
    browser.load();
    const dc = browser.Ext.create('PVE.dc.Config', { items: [{ itemId: 'discarded-by-pve' }] });

    assert.deepEqual(dc.navigation, [
        { id: 'summary', text: 'summary' },
        { id: dockerId, text: 'Docker 管理' },
    ]);
    assert.equal(dc.savedItems.summary, dc.originalItem, 'keep original card identity');
    assert.equal(dc.items, undefined, 'normal PVE lifecycle still consumes items');
    assert.equal(dc.baseInsertCalls, 1);
    assert.equal(dc.panelInitialized, true);
    assert.equal(dc.initializationResult, 'panel-initialized');

    const card = dc.savedItems[dockerId];
    assert.equal(card.xtype, 'panel');
    assert.equal(card.header, false);
    assert.equal(card.border, false);
    assert.equal(card.items.length, 0);
    for (const content of ['html', 'htmlEncode', 'loader', 'listeners', 'tbar', 'bbar',
        'dockedItems', 'buttons', 'items', 'store']) {
        if (content !== 'items') {
            assert.equal(card[content], undefined, `blank page has no ${content}`);
        }
    }
});

test('VM and CT menus retain their original cards without Docker management', () => {
    const browser = runtime();
    browser.load();
    for (const [name, originalId] of [['PVE.qemu.Config', 'hardware'], ['PVE.lxc.Config', 'resources']]) {
        const component = browser.Ext.create(name);
        assert.deepEqual(component.navigation, [{ id: originalId, text: originalId }]);
        assert.equal(component.savedItems[dockerId], undefined);
        assert.equal(component.baseInsertCalls, 1);
    }
});

test('reloading the script registers once and each datacenter gets one independent card', () => {
    const browser = runtime();
    const definitions = browser.Ext.definitions;
    browser.load();
    browser.load();
    assert.equal(browser.Ext.definitions, definitions + 1);
    const first = browser.Ext.create('PVE.dc.Config');
    const second = browser.Ext.create('PVE.dc.Config');
    assert.equal(first.navigation.filter((node) => node.id === dockerId).length, 1);
    assert.equal(second.navigation.filter((node) => node.id === dockerId).length, 1);
    assert.notEqual(first.savedItems[dockerId], second.savedItems[dockerId]);
});

test('an existing Docker card is not duplicated or replaced', () => {
    const browser = runtime();
    browser.load();
    const existingDocker = { xtype: 'panel', itemId: dockerId, title: 'Docker 管理', items: [] };
    const dc = browser.Ext.create('PVE.dc.Config', { existingDocker });
    assert.equal(dc.navigation.filter((node) => node.id === dockerId).length, 1);
    assert.equal(dc.savedItems[dockerId], existingDocker);
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
    assert.equal(items.length, 2);
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
    assert.deepEqual(dc.navigation, [{ id: 'summary', text: 'summary' }]);
});
