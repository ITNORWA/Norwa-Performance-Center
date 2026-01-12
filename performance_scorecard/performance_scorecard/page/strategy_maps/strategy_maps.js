frappe.pages['strategy-maps'].on_page_load = function (wrapper) {
    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Strategy Maps',
        single_column: true
    });

    page.set_primary_action('Refresh', function () {
        load_root_nodes();
    });

    frappe.require('/assets/performance_scorecard/css/strategy_maps.css');

    $(page.body).append(`
        <div class="strategy-map-tree">
            <div class="strategy-map-controls">
                <button type="button" class="map-btn" data-action="reload" title="Reload">
                    <i class="fa fa-refresh" aria-hidden="true"></i>
                </button>
                <button type="button" class="map-btn" data-action="zoom-out" title="Zoom out">−</button>
                <button type="button" class="map-btn" data-action="reset-zoom" title="Reset zoom">100%</button>
                <button type="button" class="map-btn" data-action="zoom-in" title="Zoom in">+</button>
            </div>
            <div id="strategy-tree"></div>
        </div>
    `);

    load_root_nodes();
    init_map_controls();
};

function init_map_controls() {
    const $container = $('.strategy-map-tree');
    const scaleState = { value: 1 };
    const minScale = 0.6;
    const maxScale = 1.6;
    const step = 0.1;

    function setScale(next) {
        const clamped = Math.max(minScale, Math.min(maxScale, next));
        scaleState.value = clamped;
        $container.get(0).style.setProperty('--tree-scale', clamped);
        $container.find('.map-btn[data-action="reset-zoom"]').text(`${Math.round(clamped * 100)}%`);
    }

    function adjustScale(delta) {
        setScale(scaleState.value + delta);
    }

    $container.on('click', '.map-btn', function () {
        const action = $(this).data('action');
        if (action === 'reload') {
            load_root_nodes();
        } else if (action === 'zoom-in') {
            adjustScale(step);
        } else if (action === 'zoom-out') {
            adjustScale(-step);
        } else if (action === 'reset-zoom') {
            setScale(1);
        }
    });

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;

    $container.on('mousedown', function (e) {
        if ($(e.target).closest('.tree-content, .tree-expand, .map-btn').length) {
            return;
        }
        isDragging = true;
        startX = e.pageX - $container.offset().left;
        startY = e.pageY - $container.offset().top;
        startScrollLeft = $container.scrollLeft();
        startScrollTop = $container.scrollTop();
        $container.addClass('is-dragging');
    });

    $(document).on('mousemove', function (e) {
        if (!isDragging) return;
        e.preventDefault();
        const x = e.pageX - $container.offset().left;
        const y = e.pageY - $container.offset().top;
        const walkX = x - startX;
        const walkY = y - startY;
        $container.scrollLeft(startScrollLeft - walkX);
        $container.scrollTop(startScrollTop - walkY);
    });

    $(document).on('mouseup', function () {
        if (!isDragging) return;
        isDragging = false;
        $container.removeClass('is-dragging');
    });

    $container.on('mouseleave', function () {
        if (!isDragging) return;
        isDragging = false;
        $container.removeClass('is-dragging');
    });

    setScale(scaleState.value);
}

function load_root_nodes() {
    $('#strategy-tree').empty();
    frappe.call({
        method: "performance_scorecard.performance_scorecard.page.strategy_maps.strategy_maps.get_root_nodes",
        callback: function (r) {
            if (r.message) {
                const roots = r.message.map(node => build_node(node, {}));
                $('#strategy-tree').append(roots);
            }
        }
    });
}

function build_node(node, context) {
    const typeClass = get_type_class(node.type);
    const colorClass = get_color_class(node.progress, node.end_date);
    const showProgress = node.type !== "Employee";
    const showType = !(node.type === "Goal" && (node.meta || "").startsWith("Company Goal"));
    const $node = $(`
        <div class="tree-node ${colorClass} ${typeClass} ${node.expandable ? 'has-children' : ''}" data-id="${node.id}" data-type="${node.type}" data-expandable="${node.expandable}">
            <div class="tree-connector"></div>
            <div class="tree-content">
                <div class="tree-circle"></div>
                <div class="tree-pill">
                    <div class="tree-title">${node.label}</div>
                    ${showType ? `<div class="tree-type">${node.type}</div>` : ""}
                    ${node.meta ? `<div class="tree-meta">${node.meta}</div>` : ''}
                    ${showProgress ? `<div class="tree-progress">
                        <div class="progress">
                            <div class="progress-bar" style="width: ${node.progress || 0}%"></div>
                        </div>
                        <span>${Math.round(node.progress || 0)}%</span>
                    </div>` : ''}
                </div>
                ${node.expandable ? '<div class="tree-expand">+</div>' : ''}
            </div>
            <div class="tree-children"></div>
        </div>
    `);

    $node.data('context', context);

    $node.find('.tree-content').on('click', function (e) {
        e.stopPropagation();
        if (!$node.data('expandable')) return;

        if ($node.hasClass('expanded')) {
            $node.removeClass('expanded');
            $node.find('.tree-children').slideUp(150);
            $node.find('.tree-expand').text('+');
            return;
        }

        load_children($node.data('type'), $node.data('id'), $node.data('context'), $node);
    });

    return $node;
}

function load_children(nodeType, nodeId, parentContext, $node) {
    let context = { ...parentContext };
    if (nodeType === 'Department') {
        context.department = nodeId;
    } else if (nodeType === 'Employee') {
        context.employee = nodeId;
    }

    frappe.call({
        method: "performance_scorecard.performance_scorecard.page.strategy_maps.strategy_maps.get_children",
        args: {
            node_type: nodeType,
            node_id: nodeId,
            context: context
        },
        callback: function (r) {
            const $children = $node.find('.tree-children');
            $children.empty();
            if (r.message && r.message.length > 0) {
                r.message.forEach(child => {
                    $children.append(build_node(child, context));
                });
                $node.addClass('expanded');
                $node.find('.tree-expand').text('–');
                $children.slideDown(150);
            } else {
                frappe.show_alert('No further items found.');
            }
        }
    });
}

function get_color_class(progress, end_date) {
    progress = progress || 0;
    if (end_date) {
        let today = frappe.datetime.get_today();
        if (end_date < today && progress < 100) {
            return 'node-red';
        }
    }
    if (progress >= 80) return 'node-green';
    if (progress >= 60) return 'node-yellow';
    return 'node-red';
}

function get_type_class(type) {
    if (!type) return "type-generic";
    const t = type.toLowerCase();
    if (t.includes("company")) return "type-company";
    if (t.includes("department")) return "type-department";
    if (t.includes("employee")) return "type-employee";
    if (t.includes("kpa")) return "type-kpa";
    if (t.includes("goal")) return "type-goal";
    if (t.includes("kra")) return "type-kra";
    if (t.includes("kpi")) return "type-kpi";
    return "type-generic";
}
