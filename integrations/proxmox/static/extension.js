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

    // Route metadata mirrors https://docker.it.blsy.team for future native views.
    // It is not a link, an iframe target, or a browser request destination.
    const pages = [
        { id: itemId, title: 'Docker', route: '/', icon: 'fa fa-cubes' },
        { id: itemId + '-stats', title: '统计', route: '/stats', icon: 'fa fa-bar-chart' },
        { id: itemId + '-servers', title: '服务器', route: '/servers', icon: 'fa fa-server' },
        { id: itemId + '-stacks', title: '应用', route: '/stacks', icon: 'fa fa-cubes' },
        { id: itemId + '-alerts', title: '告警', route: '/alerts', icon: 'fa fa-bell-o' },
        { id: itemId + '-updates', title: '操作', route: '/updates', icon: 'fa fa-history' },
        { id: itemId + '-schedules', title: '计划任务', route: '/schedules', icon: 'fa fa-calendar' },
    ];
    const pageIds = new Set(pages.map(function (page) { return page.id; }));

    function blankCards() {
        return pages.map(function (page) {
            const card = {
                xtype: 'panel',
                itemId: page.id,
                title: page.title,
                iconCls: page.icon,
                border: false,
                items: [],
                pveKomodoRoute: page.route,
            };
            if (page.id === itemId) {
                card.expandedOnInit = true;
            } else {
                // PVE consumes groups using shift(), so every card needs its own
                // fresh array, with the parent declared before its children.
                card.groups = [itemId];
            }
            return card;
        });
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
                    return item && pageIds.has(item.itemId);
                })) {
                    // Ceph is a root card with itemId "ceph". Keep every official
                    // item in order; if capabilities hide Ceph, append safely.
                    const ceph = items.findIndex(function (item) {
                        return item && item.itemId === 'ceph';
                    });
                    const position = ceph < 0 ? items.length : ceph + 1;
                    items = items.slice(0, position).concat(blankCards(), items.slice(position));
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
