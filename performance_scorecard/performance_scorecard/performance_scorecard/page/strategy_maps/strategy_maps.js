frappe.pages['strategy-maps'].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Strategy Maps',
        single_column: true
    });

    page.set_primary_action('Refresh', function () {
        load_strategy_map(page);
    });

    load_strategy_map(page);
}

function load_strategy_map(page) {
    $(page.body).empty();
    $(page.body).append('<div class="strategy-map-container">Loading...</div>');

    frappe.call({
        method: "performance_scorecard.performance_scorecard.page.strategy_maps.strategy_maps.get_strategy_map_data",
        callback: function (r) {
            if (r.message) {
                render_strategy_map(page, r.message);
            } else {
                $(page.body).find('.strategy-map-container').html('<div class="text-center text-muted">No strategy map data available.</div>');
            }
        }
    });
}

function render_strategy_map(page, data) {
    let $container = $(page.body).find('.strategy-map-container');
    $container.empty();

    if (!data.length) {
        $container.html('<div class="text-center text-muted">No active company goals found.</div>');
        return;
    }

    let html = `<div class="org-chart">`;

    data.forEach(node => {
        html += render_node(node);
    });

    html += `</div>`;
    $container.html(html);
}

function render_node(node) {
    let childrenHtml = '';
    if (node.children && node.children.length > 0) {
        childrenHtml = `<div class="children">`;
        node.children.forEach(child => {
            childrenHtml += render_node(child);
        });
        childrenHtml += `</div>`;
    }

    return `
        <div class="node-wrapper">
            <div class="node ${node.type.toLowerCase()}">
                <div class="node-title">${node.label}</div>
                <div class="node-meta">${node.type}</div>
            </div>
            ${childrenHtml}
        </div>
    `;
}
