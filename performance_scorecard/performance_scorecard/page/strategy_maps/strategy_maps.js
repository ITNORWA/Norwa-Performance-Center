frappe.pages['strategy-maps'].on_page_load = function (wrapper) {
    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Strategy Maps',
        single_column: true
    });

    page.set_primary_action('Refresh', function () {
<<<<<<< HEAD
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

    load_root_nodes();
};

=======
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

>>>>>>> origin/newton-manyisa
function load_root_nodes() {
    $('#strategy-tree').empty();
    frappe.call({
        method: "performance_scorecard.performance_scorecard.page.strategy_maps.strategy_maps.get_root_nodes",
        callback: function (r) {
            if (r.message) {
<<<<<<< HEAD
                add_column(page, r.message, "Company", {});
=======
                const roots = r.message.map(node => build_node(node, {}));
                $('#strategy-tree').append(roots);
>>>>>>> origin/newton-manyisa
            }
        }
    });
}

<<<<<<< HEAD
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
=======
function build_node(node, context) {
    const typeClass = get_type_class(node.type);
    const colorClass = get_color_class(node.progress, node.end_date);
    const showProgress = node.type !== "Employee";
    const $node = $(`
        <div class="tree-node ${colorClass} ${typeClass} ${node.expandable ? 'has-children' : ''}" data-id="${node.id}" data-type="${node.type}" data-expandable="${node.expandable}">
            <div class="tree-connector"></div>
            <div class="tree-content">
                <div class="tree-circle"></div>
                <div class="tree-pill">
                    <div class="tree-title">${node.label}</div>
                    <div class="tree-type">${node.type}</div>
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
>>>>>>> origin/newton-manyisa
    }

    frappe.call({
        method: "performance_scorecard.performance_scorecard.page.strategy_maps.strategy_maps.get_children",
        args: {
            node_type: nodeType,
            node_id: nodeId,
            context: context
        },
        callback: function (r) {
<<<<<<< HEAD
            if (r.message && r.message.length > 0) {
                // Determine next column type for header
                let nextType = r.message[0].type;
                add_column(page, r.message, nextType, context);
=======
            const $children = $node.find('.tree-children');
            $children.empty();
            if (r.message && r.message.length > 0) {
                r.message.forEach(child => {
                    $children.append(build_node(child, context));
                });
                $node.addClass('expanded');
                $node.find('.tree-expand').text('–');
                $children.slideDown(150);
>>>>>>> origin/newton-manyisa
            } else {
                frappe.show_alert('No further items found.');
            }
        }
    });
}

<<<<<<< HEAD
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
=======
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
>>>>>>> origin/newton-manyisa
