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
                        items: [],
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
