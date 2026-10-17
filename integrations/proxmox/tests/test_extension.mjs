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
    const requests = [];
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
        requests,
        Ajax: { request: (options) => requests.push(options) },
        String: {
            htmlEncode: (value) => String(value).replace(/[&<>"']/g, (character) => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
            })[character]),
        },
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
    const forbiddenRequest = () => { throw new Error('extension must use only the same-origin Ext.Ajax API'); };
    const context = vm.createContext({
        window: { Ext, console: { warn: (...args) => warnings.push(args) } },
        fetch: forbiddenRequest,
        XMLHttpRequest: forbiddenRequest,
    });
    return { Ext, warnings, load: () => vm.runInContext(extension, context) };
}

test('datacenter gains a native status card after PVE initializes its original items', () => {
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
    assert.equal(card.items.length, 2);
    assert.equal(card.items[0].xtype, 'button');
    assert.equal(card.items[0].text, '检查连接');
    assert.equal(card.items[1].xtype, 'component');
    assert.equal(card.items[1].html, '尚未检查连接');
    for (const content of ['html', 'loader', 'tbar', 'bbar', 'dockedItems', 'buttons', 'store']) {
        assert.equal(card[content], undefined, `status card has no ${content}`);
    }
    assert.equal(browser.Ext.requests.length, 0, 'registering and building menus must not contact the API');
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

function connectionCard(browser = runtime()) {
    browser.load();
    const dc = browser.Ext.create('PVE.dc.Config');
    const config = dc.savedItems[dockerId];
    const status = {
        destroyed: false,
        html: config.items[1].html,
        updates: [],
        update(value) {
            assert.equal(this.destroyed, false, 'never update a destroyed component');
            this.html = value;
            this.updates.push(value);
        },
    };
    const button = {
        ...config.items[0],
        disabled: false,
        destroyed: false,
        setDisabled(value) {
            assert.equal(this.destroyed, false, 'never update a destroyed button');
            this.disabled = value;
        },
        up(selector) {
            assert.equal(selector, '#' + dockerId);
            return panel;
        },
    };
    const panel = {
        destroyed: false,
        down(selector) {
            return selector === '#pve-komodo-check-connection' ? button :
                selector === '#pve-komodo-connection-status' ? status : undefined;
        },
    };
    return {
        browser, panel, button, status,
        activate: () => config.listeners.activate(panel),
        check: () => button.handler(button),
        respond(payload, code = 200, index = browser.Ext.requests.length - 1) {
            const options = browser.Ext.requests[index];
            options.callback(options, code >= 200 && code < 300, {
                status: code,
                responseText: typeof payload === 'string' ? payload : JSON.stringify(payload),
            });
        },
    };
}

test('only first activation of the Docker page starts a read-only same-origin check', () => {
    const card = connectionCard();
    assert.equal(card.browser.Ext.requests.length, 0);
    card.activate();
    assert.equal(card.browser.Ext.requests.length, 1);
    const options = card.browser.Ext.requests[0];
    assert.equal(options.method, 'GET');
    assert.equal(options.url, '/pve-komodo/api/connection');
    for (const privateData of ['headers', 'params', 'jsonData', 'rawData', 'urlData']) {
        assert.equal(options[privateData], undefined);
    }
    assert.equal(card.button.disabled, true);
    assert.equal(card.status.html, '正在检查连接…');
    card.activate();
    card.check();
    assert.equal(card.browser.Ext.requests.length, 1, 'pending check cannot be submitted twice');

    card.respond({ user: 'root@pam', komodo: { configured: false, connected: false } });
    assert.equal(card.status.html, 'Komodo 未配置凭据');
    assert.equal(card.button.disabled, false);
    card.activate();
    assert.equal(card.browser.Ext.requests.length, 1, 'activation is checked once per card');
    card.check();
    assert.equal(card.browser.Ext.requests.length, 2, 'manual retry is allowed');
});

test('connected status HTML-encodes the upstream version and does not display identity or secrets', () => {
    const card = connectionCard();
    card.activate();
    card.respond({
        user: 'root@pam',
        komodo: {
            configured: true, connected: true,
            version: '2.3.3 <img src=x onerror="alert(1)"> & \'test\'',
            username: 'PRIVATE_SERVICE_USER',
            key: 'PRIVATE_KEY', secret: 'PRIVATE_SECRET', url: 'https://private.invalid',
        },
    });
    assert.equal(card.status.html,
        'Komodo 已连接（版本 2.3.3 &lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;test&#39;）');
    for (const privateValue of ['PRIVATE_SERVICE_USER', 'PRIVATE_KEY', 'PRIVATE_SECRET', 'private.invalid']) {
        assert.equal(card.status.html.includes(privateValue), false);
    }
    assert.equal(card.button.disabled, false);
});

test('PVE authentication errors use fixed messages and can be retried', () => {
    for (const [code, message] of [
        [401, 'PVE 未登录或会话已过期'], [403, '无访问权限'],
        [503, 'PVE 会话验证不可用'], [500, 'Komodo 连接失败'], [0, 'Komodo 连接失败'],
    ]) {
        const card = connectionCard();
        card.activate();
        card.respond({ detail: 'PRIVATE_SECRET https://private.invalid' }, code);
        assert.equal(card.status.html, message);
        assert.equal(card.button.disabled, false);
        card.check();
        assert.equal(card.browser.Ext.requests.length, 2);
        card.respond({ user: 'root@pam', komodo: { configured: true, connected: true, version: '2.3.3' } });
        assert.equal(card.status.html, 'Komodo 已连接（版本 2.3.3）');
    }
});

test('disconnected, malformed, and unexpected responses never render upstream error text', () => {
    for (const payload of [
        { user: 'root@pam', komodo: { configured: true, connected: false, error_code: 'PRIVATE_SECRET' } },
        { user: 'root@pam', komodo: { configured: false, connected: true } },
        { user: 'root@pam', komodo: { configured: true, connected: true, version: { private: 'SECRET' } } },
        { error: 'PRIVATE_SECRET' }, null, 'invalid json PRIVATE_SECRET',
    ]) {
        const card = connectionCard();
        card.activate();
        assert.doesNotThrow(() => card.respond(payload));
        assert.equal(card.status.html, 'Komodo 连接失败');
        assert.equal(card.button.disabled, false);
    }
});

test('callbacks after card destruction do not modify the panel or its children', () => {
    for (const property of ['destroyed', 'destroying']) {
        const card = connectionCard();
        card.activate();
        card.panel[property] = true;
        card.button.destroyed = true;
        card.status.destroyed = true;
        const before = { ...card.panel };
        const updateCount = card.status.updates.length;
        assert.doesNotThrow(() => card.respond({
            user: 'root@pam', komodo: { configured: true, connected: true, version: '2.3.3' },
        }));
        assert.deepEqual(card.panel, before);
        assert.equal(card.status.updates.length, updateCount);
        assert.equal(card.button.disabled, true);
    }
});

test('a synchronous request error clears the pending state and permits retry', () => {
    const browser = runtime();
    const request = browser.Ext.Ajax.request;
    browser.Ext.Ajax.request = () => { throw new Error('PRIVATE_SECRET'); };
    const card = connectionCard(browser);
    assert.doesNotThrow(card.activate);
    assert.equal(card.status.html, 'Komodo 连接失败');
    assert.equal(card.button.disabled, false);
    browser.Ext.Ajax.request = request;
    card.check();
    assert.equal(browser.Ext.requests.length, 1);
    assert.equal(card.button.disabled, true);
});
