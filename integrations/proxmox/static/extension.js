(function () {
    // ExtJS callParent resolves method metadata through Function.caller, so its
    // overriding methods must remain ordinary, non-strict script functions.

    const overrideName = 'PVEKomodo.override.DatacenterConfig';
    const registrationKey = '__pveKomodoDatacenterExtensionLoaded';
    const itemId = 'pve-komodo-docker';
    const Ext = window.Ext;

    // This script must load after pvemanagerlib.js and before StdWorkspace starts.
    // An unknown PVE interface leaves the original page untouched.
    if (window[registrationKey] || !Ext || !Ext.ClassManager ||
        typeof Ext.ClassManager.get !== 'function' ||
        typeof Ext.define !== 'function') {
        return;
    }

    const DatacenterConfig = Ext.ClassManager.get('PVE.dc.Config');
    if (!DatacenterConfig || !DatacenterConfig.prototype ||
        typeof DatacenterConfig.prototype.insertNodes !== 'function') {
        return;
    }

    function isAlive(panel) {
        return panel && !panel.destroyed && !panel.destroying;
    }

    function checkConnection(panel) {
        if (!isAlive(panel) || panel._pveKomodoChecking) {
            return;
        }
        const button = panel.down('#pve-komodo-check-connection');
        const status = panel.down('#pve-komodo-connection-status');
        if (!button || !status) {
            return;
        }

        function updateStatus(text) {
            // Never render an upstream version or other response value as HTML.
            status.update(Ext.String.htmlEncode(text));
        }

        panel._pveKomodoChecking = true;
        panel._pveKomodoInitialCheck = true;
        button.setDisabled(true);
        updateStatus('正在检查连接…');

        function complete(options, success, response) {
            if (!isAlive(panel) || !isAlive(button) || !isAlive(status)) {
                return;
            }
            panel._pveKomodoChecking = false;
            button.setDisabled(false);
            let message = 'Komodo 连接失败';
            if (response && response.status === 401) {
                message = 'PVE 未登录或会话已过期';
            } else if (response && response.status === 403) {
                message = '无访问权限';
            } else if (response && response.status === 503) {
                message = 'PVE 会话验证不可用';
            } else if (success) {
                try {
                    const result = JSON.parse(response.responseText);
                    const komodo = result && result.komodo;
                    if (komodo && komodo.configured === false && komodo.connected === false) {
                        message = 'Komodo 未配置凭据';
                    } else if (komodo && komodo.configured === true &&
                        komodo.connected === true && typeof komodo.version === 'string') {
                        message = 'Komodo 已连接（版本 ' + komodo.version + '）';
                    }
                } catch (error) {
                    // Use a fixed message; error bodies may contain private data.
                }
            }
            updateStatus(message);
        }

        try {
            // API2Request would prefix /api2; this is our own same-origin API.
            // Ext.Ajax uses the browser's existing PVE session cookie.
            Ext.Ajax.request({
                url: '/pve-komodo/api/connection',
                method: 'GET',
                timeout: 60000,
                callback: complete,
            });
        } catch (error) {
            complete(null, false, null);
        }
    }

    try {
        Ext.define(overrideName, {
            override: 'PVE.dc.Config',

            // PVE.dc.Config replaces me.items in initComponent. Its parent then
            // builds both the navigation tree and saved cards through insertNodes.
            // Override this inherited method only on the datacenter class, while
            // its declarative items still exist, rather than editing a live tree.
            // Verified with pve-manager 9.2.22 (aa7db891):
            // www/manager6/dc/Config.js and panel/ConfigPanel.js.
            insertNodes: function (items) {
                if (Array.isArray(items) && !items.some(function (item) {
                    return item && item.itemId === itemId;
                })) {
                    items = items.concat([{
                        xtype: 'panel',
                        itemId: itemId,
                        title: 'Docker 管理',
                        iconCls: 'fa fa-cubes',
                        border: false,
                        bodyPadding: 16,
                        layout: { type: 'vbox', align: 'begin' },
                        items: [{
                            xtype: 'button',
                            itemId: 'pve-komodo-check-connection',
                            text: '检查连接',
                            handler: function (button) {
                                checkConnection(button.up('#' + itemId));
                            },
                        }, {
                            xtype: 'component',
                            itemId: 'pve-komodo-connection-status',
                            margin: '12 0 0 0',
                            html: '尚未检查连接',
                            autoEl: { tag: 'div', role: 'status', 'aria-live': 'polite' },
                        }],
                        listeners: {
                            activate: function (panel) {
                                // PVE creates saved cards lazily. Do not check
                                // from page startup or an afterrender listener.
                                if (!panel._pveKomodoInitialCheck) {
                                    checkConnection(panel);
                                }
                            },
                        },
                    }]);
                }

                return this.callParent([items]);
            },
        });
        // ExtJS override declarations are not ordinary ClassManager classes.
        // Keep our own marker so a second script load cannot wrap the method again.
        window[registrationKey] = true;
    } catch (error) {
        // The extension must not stop PVE from booting if registration is refused.
        if (window.console && typeof window.console.warn === 'function') {
            window.console.warn('PVE Komodo extension could not be registered.', error);
        }
    }
}());
