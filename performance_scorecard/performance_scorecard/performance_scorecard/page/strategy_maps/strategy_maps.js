frappe.pages['strategy-maps'].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Strategy Maps',
        single_column: true
    });

    page.set_primary_action('Refresh', function () {
        load_root_nodes(page);
    });

    // Add CSS
    frappe.require('/assets/performance_scorecard/css/strategy_maps.css');

    // Container for the map
    $(page.body).append(`
        <div class="strategy-map-wrapper">
            <div class="strategy-map-scroll">
                <div class="strategy-columns" id="strategy-columns">
                    <!-- Columns will be added here dynamically -->
                </div>
            </div>
        </div>
    `);

    // Fetch settings first
    frappe.db.get_single('Performance Settings').then(settings => {
        page.performance_settings = settings;
        load_root_nodes(page);
    });
}

function load_root_nodes(page) {
    $('#strategy-columns').empty();

    frappe.call({
        method: "performance_scorecard.performance_scorecard.page.strategy_maps.strategy_maps.get_root_nodes",
        callback: function (r) {
            if (r.message) {
                add_column(page, r.message, "Company", {});
            }
        }
    });
}

function add_column(page, nodes, type, context) {
    let $columns = $('#strategy-columns');
    let colId = 'col-' + ($columns.children().length + 1);

    let $col = $(`
        <div class="strategy-column" id="${colId}">
            <div class="column-header">${type}</div>
            <div class="column-body"></div>
        </div>
    `);

    $columns.append($col);

    let $body = $col.find('.column-body');

    nodes.forEach(node => {
        let colorClass = get_color_class(page, node.progress, node.end_date);
        let $node = $(`
            <div class="strategy-node ${colorClass}" data-id="${node.id}" data-type="${node.type}" data-expandable="${node.expandable}">
                <div class="node-label">${node.label}</div>
                <div class="node-progress">
                    <div class="progress">
                        <div class="progress-bar" style="width: ${node.progress || 0}%"></div>
                    </div>
                    <span class="progress-text">${Math.round(node.progress || 0)}%</span>
                </div>
                ${node.expandable ? '<div class="node-arrow"><i class="fa fa-chevron-right"></i></div>' : ''}
            </div>
        `);

        // Store context on the node element for retrieval
        $node.data('context', context);

        $node.on('click', function () {
            let $this = $(this);

            // Highlight selection
            $col.find('.strategy-node').removeClass('selected');
            $this.addClass('selected');

            // Remove subsequent columns
            $col.nextAll().remove();

            if ($this.data('expandable')) {
                load_children(page, $this.data('type'), $this.data('id'), $this.data('context'));
            }
        });

        $body.append($node);
    });

    // Scroll to right
    $('.strategy-map-scroll').animate({ scrollLeft: 10000 }, 500);
}

function load_children(page, nodeType, nodeId, parentContext) {
    // Update context based on node type
    let context = { ...parentContext };
    if (nodeType === 'Department') {
        context.department = nodeId; // nodeId is department name
    } else if (nodeType === 'Employee') {
        context.employee = nodeId; // nodeId is employee name
    }

    frappe.call({
        method: "performance_scorecard.performance_scorecard.page.strategy_maps.strategy_maps.get_children",
        args: {
            node_type: nodeType,
            node_id: nodeId,
            context: context
        },
        callback: function (r) {
            if (r.message && r.message.length > 0) {
                // Determine next column type for header
                let nextType = r.message[0].type;
                add_column(page, r.message, nextType, context);
            } else {
                frappe.show_alert('No further items found.');
            }
        }
    });
}

function get_color_class(page, progress, end_date) {
    progress = progress || 0;
    let settings = page.performance_settings || {};

    let critical = settings.critical_threshold || 50;
    let warning = settings.warning_threshold || 75;
    let success = settings.success_threshold || 76;

    // Check timeline
    if (end_date) {
        let today = frappe.datetime.get_today();
        if (end_date < today && progress < 100) {
            return 'node-red'; // Past due
        }
    }

    if (progress >= success) return 'node-green';
    if (progress >= warning) return 'node-blue'; // Blue is used for "On Track" in this UI
    if (progress >= critical) return 'node-yellow';
    return 'node-red';
}
