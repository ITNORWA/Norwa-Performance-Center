frappe.pages['strategy-plans'].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Strategy Plans',
        single_column: true
    });

    // Add Premium Sidebar
    render_sidebar(page);

    // Initial Load
    load_strategy_data(page, 'Company');
};

function render_sidebar(page) {
    let sidebar_html = `
        <div class="pc-sidebar">
            <div class="sidebar-header">
                <img src="/assets/performance_scorecard/images/performance_scorecard_logo.jpg" class="sidebar-logo">
                <span class="sidebar-title">Performance Center</span>
            </div>
            <nav class="sidebar-nav">
                <a href="/app/performance-dashboard" class="nav-item">
                    <i class="fa fa-th-large"></i> Home
                </a>
                <a href="/app/strategy-plans" class="nav-item active">
                    <i class="fa fa-map"></i> Strategy Plans
                </a>
                <a href="/app/strategy-maps" class="nav-item">
                    <i class="fa fa-sitemap"></i> Strategy Maps
                </a>
                <a href="/app/risk-dashboard" class="nav-item">
                    <i class="fa fa-warning"></i> Risk Management
                </a>
                <div class="nav-divider"></div>
                <a href="#" class="nav-item" id="nav-administration">
                    <i class="fa fa-cog"></i> Administration
                </a>
            </nav>
        </div>
    `;

    $(page.wrapper).find('.layout-side-section').remove();
    $(page.wrapper).find('.layout-main-section').before(sidebar_html);

    $(page.wrapper).find('#nav-administration').on('click', function (e) {
        e.preventDefault();
        frappe.set_route('Form', 'Performance Settings');
    });
}

function load_strategy_data(page, level) {
    let $container = $(page.main);
    $container.empty();

    // Toolbar & Tabs
    let toolbar_html = `
        <div class="strategy-toolbar d-flex justify-content-between align-items-center mb-4">
            <div class="strategy-tabs">
                <button class="btn btn-sm btn-tab ${level === 'Company' ? 'active' : ''}" data-level="Company">Company Strategy</button>
                <button class="btn btn-sm btn-tab ${level === 'Department' ? 'active' : ''}" data-level="Department">Department Strategy</button>
                <button class="btn btn-sm btn-tab ${level === 'Individual' ? 'active' : ''}" data-level="Individual">My Performance</button>
            </div>
            <div class="strategy-actions">
                <button class="btn btn-primary btn-sm rounded-pill px-3" id="btn-add-goal">
                    <i class="fa fa-plus"></i> Add Goal
                </button>
            </div>
        </div>
    `;
    $container.append(toolbar_html);

    // Filters for Department Level
    if (level === 'Department') {
        let filters_html = `
            <div class="strategy-filters mb-3 p-3 bg-light rounded shadow-sm border-0 d-flex align-items-center gap-2">
                <span class="text-muted fw-bold small me-2"><i class="fa fa-filter"></i> FILTER BY DEPARTMENT:</span>
                <div id="dept-filter-container" style="flex: 1; max-width: 300px;"></div>
            </div>
        `;
        $container.append(filters_html);

        page.dept_field = frappe.ui.form.make_control({
            parent: $container.find('#dept-filter-container'),
            df: {
                fieldtype: 'Link',
                options: 'Department',
                fieldname: 'department',
                placeholder: 'Select Department...',
                on_change: () => {
                    let dept = page.dept_field.get_value();
                    fetch_strategy_data(page, level, dept);
                }
            },
            render_input: true
        });
    }

    $container.append('<div id="strategy-content-area" class="mt-4"><div class="text-center p-5"><div class="spinner-border text-primary" role="status"></div></div></div>');

    // Bind Tab Click
    $container.find('.btn-tab').on('click', function () {
        let new_level = $(this).data('level');
        load_strategy_data(page, new_level);
    });

    // Bind Add Goal
    $container.find('#btn-add-goal').on('click', function () {
        make_goal_dialog(level, () => load_strategy_data(page, level));
    });

    fetch_strategy_data(page, level);
}

function fetch_strategy_data(page, level, department = None) {
    if (department === undefined) department = null;
    frappe.call({
        method: 'performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.get_strategy_data',
        args: { level: level, department: department },
        callback: function (r) {
            render_strategy_table(page, r.message, level);
        }
    });
}

function render_strategy_table(page, data, level) {
    let $content = $(page.main).find('#strategy-content-area');
    $content.empty();

    if (!data.goals || data.goals.length === 0) {
        $content.html('<div class="alert alert-info border-0 shadow-sm rounded-pill text-center">No strategy plans found for this level.</div>');
        return;
    }

    let goals_html = data.goals.map(goal => `
        <div class="strategy-goal-card mb-4 border-0 shadow-sm rounded-lg overflow-hidden">
            <div class="goal-header p-3 px-4 d-flex justify-content-between align-items-center bg-white border-bottom">
                <div>
                    <span class="badge bg-soft-primary text-primary mb-1 uppercase tracking-wider small">${goal.kpa_label || 'Strategic Goal'}</span>
                    <h5 class="mb-0 fw-bold clickable-goal text-dark" data-name="${goal.name}">${goal.goal_name}</h5>
                    ${goal.parent_goal_name ? `<div class="small text-muted mt-1"><i class="fa fa-level-up fa-rotate-90"></i> Supporting: ${goal.parent_goal_name}</div>` : ''}
                </div>
                <div class="d-flex align-items-center gap-4">
                    <div class="text-end">
                        <div class="small text-muted mb-1">Target End Date</div>
                        <div class="fw-bold">${goal.end_date ? frappe.datetime.str_to_user(goal.end_date) : 'Flexible'}</div>
                    </div>
                    <div class="progress-wrapper" style="width: 150px;">
                        <div class="d-flex justify-content-between mb-1 small">
                            <span class="fw-semibold">Progress</span>
                            <span class="fw-bold">${Math.round(goal.progress)}%</span>
                        </div>
                        <div class="progress" style="height: 6px;">
                            <div class="progress-bar ${get_progress_color(goal.progress)}" role="progressbar" style="width: ${goal.progress}%"></div>
                        </div>
                    </div>
                    <div class="goal-actions">
                        <button class="btn btn-outline-secondary btn-xs btn-edit-goal border-0 rounded-pill" data-name="${goal.name}">
                            <i class="fa fa-pencil"></i>
                        </button>
                        <button class="btn btn-outline-primary btn-xs btn-add-kra border-0 rounded-pill" data-name="${goal.name}" data-goal_name="${goal.goal_name}">
                            <i class="fa fa-plus"></i> KRA
                        </button>
                    </div>
                </div>
            </div>
            <div class="goal-body p-0 bg-white">
                <table class="table table-hover mb-0 kra-table align-middle">
                    <thead class="bg-light">
                        <tr class="small text-muted text-uppercase fw-bold">
                            <th class="ps-4 border-0" style="width: 35%;">Key Result Area (KRA)</th>
                            <th class="border-0" style="width: 15%;">Priority</th>
                            <th class="border-0" style="width: 15%;">Weight</th>
                            <th class="border-0" style="width: 25%;">Progress / Performance</th>
                            <th class="border-0 pe-4" style="width: 10%;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${goal.kras.map(kra => `
                            <tr>
                                <td class="ps-4 py-3">
                                    <div class="fw-bold clickable-kra text-primary" data-name="${kra.name}">${kra.kra_name}</div>
                                    <div class="small text-muted text-truncate">${kra.description || 'Focus on achieving target metrics'}</div>
                                </td>
                                <td><span class="badge ${get_priority_badge(kra.priority)} rounded-pill px-2">${kra.priority}</span></td>
                                <td class="fw-semibold">${kra.weightage}%</td>
                                <td>
                                    <div class="d-flex align-items-center gap-2">
                                        <div class="progress flex-grow-1" style="height: 4px;">
                                            <div class="progress-bar ${get_progress_color(kra.progress)}" role="progressbar" style="width: ${kra.progress}%"></div>
                                        </div>
                                        <span class="small fw-bold min-w-30">${Math.round(kra.progress)}%</span>
                                    </div>
                                </td>
                                <td class="text-end pe-4">
                                    <button class="btn btn-link btn-xs p-0 m-0 text-muted btn-edit-kra" data-name="${kra.name}">
                                        <i class="fa fa-pencil"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `).join('');

    $content.html(goals_html);

    // Bind Events
    $content.find('.btn-edit-goal, .clickable-goal').on('click', function () {
        edit_goal_dialog($(this).data('name'), () => load_strategy_data(page, level));
    });

    $content.find('.btn-edit-kra, .clickable-kra').on('click', function () {
        edit_kra_dialog($(this).data('name'), () => load_strategy_data(page, level));
    });

    $content.find('.btn-add-kra').on('click', function () {
        let goal_id = $(this).data('name');
        let goal_name = $(this).data('goal_name');
        make_kra_dialog(level, () => load_strategy_data(page, level), goal_id, goal_name);
    });
}

function get_progress_color(progress) {
    if (progress >= 80) return 'bg-success';
    if (progress >= 50) return 'bg-warning';
    return 'bg-danger';
}

function get_priority_badge(priority) {
    if (priority === 'High') return 'bg-soft-danger text-danger';
    if (priority === 'Medium') return 'bg-soft-warning text-warning';
    return 'bg-soft-success text-success';
}

function make_goal_dialog(level, callback) {
    let d = new frappe.ui.Dialog({
        title: 'Define Strategic Goal',
        fields: [
            { label: 'Strategic Goal', fieldname: 'goal_name', fieldtype: 'Data', reqd: 1 },
            { label: 'Focus Area (KPA)', fieldname: 'kpa', fieldtype: 'Link', options: 'KPA Master', reqd: 1 },
            { label: 'Supporting Goal (Optional)', fieldname: 'parent_goal', fieldtype: 'Link', options: 'Goal' },
            { label: 'Weightage (%)', fieldname: 'weightage', fieldtype: 'Percent', default: 0 },
            { fieldtype: 'Section Break' },
            { label: 'Start Date', fieldname: 'start_date', fieldtype: 'Date', default: frappe.datetime.get_today() },
            { label: 'Target Completion', fieldname: 'end_date', fieldtype: 'Date' },
            { fieldtype: 'Column Break' },
            { label: 'Owner Type', fieldname: 'owner_type', fieldtype: 'Select', options: 'Company\nDepartment\nEmployee', default: level, read_only: 1 },
            { label: 'Department', fieldname: 'department', fieldtype: 'Link', options: 'Department', default: frappe.session.user_department, hidden: level !== 'Department' },
            { label: 'Employee', fieldname: 'employee', fieldtype: 'Link', options: 'Employee', default: frappe.session.user_employee, hidden: level !== 'Employee' }
        ],
        primary_action_label: 'Set Goal',
        primary_action(values) {
            frappe.call({
                method: 'frappe.client.insert',
                args: { doc: { doctype: 'Goal', ...values } },
                callback: function (r) {
                    if (!r.exc) {
                        d.hide();
                        frappe.show_alert({ message: 'Goal Defined Successfully', indicator: 'green' });
                        if (callback) callback();
                    }
                }
            });
        }
    });
    d.show();
}

function make_kra_dialog(level, callback, goal_id = null, goal_name = null) {
    let d = new frappe.ui.Dialog({
        title: 'New KRA' + (goal_name ? ` for ${goal_name}` : ''),
        fields: [
            { label: 'KRA Name', fieldname: 'kra_name', fieldtype: 'Data', reqd: 1 },
            { label: 'Parent Goal', fieldname: 'goal', fieldtype: 'Link', options: 'Goal', reqd: 1, default: goal_id },
            { label: 'Weightage (%)', fieldname: 'weightage', fieldtype: 'Percent', default: 0 },
            { label: 'Priority', fieldname: 'priority', fieldtype: 'Select', options: 'Low\nMedium\nHigh', default: 'Medium' },
            { label: 'Description', fieldname: 'description', fieldtype: 'Small Text' }
        ],
        primary_action_label: 'Create KRA',
        primary_action(values) {
            frappe.call({
                method: 'frappe.client.insert',
                args: { doc: { doctype: 'KRA', ...values } },
                callback: function (r) {
                    if (!r.exc) {
                        d.hide();
                        frappe.show_alert({ message: 'KRA Created', indicator: 'green' });
                        if (callback) callback();
                    }
                }
            });
        }
    });
    d.show();
}

function edit_goal_dialog(goal_name, callback) {
    frappe.db.get_doc('Goal', goal_name).then(doc => {
        let d = new frappe.ui.Dialog({
            title: 'Refine Goal: ' + doc.goal_name,
            fields: [
                { label: 'Goal Name', fieldname: 'goal_name', fieldtype: 'Data', reqd: 1, default: doc.goal_name },
                { label: 'Focus Area (KPA)', fieldname: 'kpa', fieldtype: 'Link', options: 'KPA Master', default: doc.kpa },
                { label: 'Status', fieldname: 'status', fieldtype: 'Select', options: 'Draft\nActive\nCompleted\nArchived', default: doc.status },
                { label: 'Progress (%)', fieldname: 'progress', fieldtype: 'Percent', read_only: 1, default: doc.progress }
            ],
            primary_action_label: 'Save Changes',
            primary_action(values) {
                frappe.call({
                    method: 'frappe.client.save',
                    args: { doc: { doctype: 'Goal', name: goal_name, ...values } },
                    callback: function (r) {
                        if (!r.exc) {
                            d.hide();
                            frappe.show_alert({ message: 'Changes Saved', indicator: 'green' });
                            if (callback) callback();
                        }
                    }
                });
            }
        });
        d.show();
    });
}

function edit_kra_dialog(kra_name, callback) {
    frappe.db.get_doc('KRA', kra_name).then(doc => {
        let d = new frappe.ui.Dialog({
            title: 'Edit KRA: ' + doc.kra_name,
            fields: [
                { label: 'KRA Name', fieldname: 'kra_name', fieldtype: 'Data', reqd: 1, default: doc.kra_name },
                { label: 'Weightage (%)', fieldname: 'weightage', fieldtype: 'Percent', default: doc.weightage },
                { label: 'Priority', fieldname: 'priority', fieldtype: 'Select', options: 'Low\nMedium\nHigh', default: doc.priority },
                { label: 'Description', fieldname: 'description', fieldtype: 'Small Text', default: doc.description }
            ],
            primary_action_label: 'Update',
            primary_action(values) {
                frappe.call({
                    method: 'frappe.client.save',
                    args: { doc: { doctype: 'KRA', name: kra_name, ...values } },
                    callback: function (r) {
                        if (!r.exc) {
                            d.hide();
                            frappe.show_alert({ message: 'KRA Updated', indicator: 'green' });
                            if (callback) callback();
                        }
                    }
                });
            }
        });
        d.show();
    });
}

// Real-time listener for refreshes
frappe.realtime.on('strategy_refresh', function (data) {
    if (frappe.get_route()[0] === 'strategy-plans') {
        let level = $('.btn-tab.active').data('level');
        load_strategy_data(frappe.pages['strategy-plans'], level);
    }
});
