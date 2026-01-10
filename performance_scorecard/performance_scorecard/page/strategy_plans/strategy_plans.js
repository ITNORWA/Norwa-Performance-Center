frappe.pages['strategy-plans'].on_page_load = function (wrapper) {
    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Strategy Plans',
        single_column: true
    });

<<<<<<< HEAD
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
=======
    wrapper.strategy_plans = {
        page: page,
        level: 'Company',
        realtime_registered: false
    };

    page.main.append(`
        <div class="strategy-tabs" style="margin-bottom: 20px;">
            <ul class="nav nav-tabs">
                <li class="nav-item">
                    <a class="nav-link active" data-level="Company" href="#">Company Strategy</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" data-level="Department" href="#">Department Strategy</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" data-level="Individual" href="#">My Performance</a>
                </li>
            </ul>
        </div>
        <div class="strategy-actions" style="margin-bottom: 15px; display: none; gap: 8px;">
             <button class="btn btn-primary btn-sm" id="btn-add-goal">Add Goal</button>
             <button class="btn btn-default btn-sm" id="btn-add-kra">Add KRA</button>
             <button class="btn btn-default btn-sm" id="btn-add-kpi">Add KPI</button>
        </div>
        <div class="strategy-content">
            <!-- Content will be loaded here -->
        </div>
    `);

    page.main.find('.nav-link').on('click', function (e) {
        e.preventDefault();
        page.main.find('.nav-link').removeClass('active');
        $(this).addClass('active');
        let level = $(this).data('level');
        wrapper.strategy_plans.level = level;
        update_actions(page, level);
        load_strategy_data(page, level);
    });

    page.main.find('#btn-add-goal').on('click', function () {
        let level = wrapper.strategy_plans.level;
        make_goal_dialog(level, function () { load_strategy_data(page, level); });
    });

    page.main.find('#btn-add-kra').on('click', function () {
        let level = wrapper.strategy_plans.level;
        make_kra_dialog(level, function () { load_strategy_data(page, level); });
    });

    page.main.find('#btn-add-kpi').on('click', function () {
        let level = wrapper.strategy_plans.level;
        make_kpi_dialog(level, function () { load_strategy_data(page, level); });
    });

    register_realtime_refresh(wrapper);

    update_actions(page, 'Company');
    load_strategy_data(page, 'Company');
};

function get_level_config(level) {
    if (level === 'Company') {
        return { owner_type: 'Company', allow_goal: true, allow_kra: false, allow_kpi: false, show_kpi: false };
    }
    if (level === 'Department') {
        return { owner_type: 'Department', allow_goal: true, allow_kra: true, allow_kpi: false, show_kpi: false };
    }
    return { owner_type: 'Employee', allow_goal: true, allow_kra: true, allow_kpi: true, show_kpi: true };
}

function update_actions(page, level) {
    const config = get_level_config(level);
    let $actions = page.main.find('.strategy-actions');

    if (config.allow_goal || config.allow_kra || config.allow_kpi) {
        $actions.show();
        $actions.find('#btn-add-goal').toggle(!!config.allow_goal).text(level === 'Company' ? 'Add Company Goal' : level === 'Department' ? 'Add Department Goal' : 'Add Personal Goal');
        $actions.find('#btn-add-kra').toggle(!!config.allow_kra);
        $actions.find('#btn-add-kpi').toggle(!!config.allow_kpi);
    } else {
        $actions.hide();
    }
}

function register_realtime_refresh(wrapper) {
    if (wrapper.strategy_plans.realtime_registered) {
        return;
    }

    frappe.realtime.on('strategy_plans_refresh', (data) => {
        const level = wrapper.strategy_plans.level;
        if (data && data.level && data.level !== level) {
            return;
        }
        load_strategy_data(wrapper.strategy_plans.page, level);
    });

    wrapper.strategy_plans.realtime_registered = true;
}

function load_strategy_data(page, level) {
    let $content = page.main.find('.strategy-content');
    $content.html('<div class="text-center text-muted">Loading...</div>');

    frappe.call({
        method: 'performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.get_strategy_data',
        args: { level: level },
        callback: function (r) {
            if (r.message) {
                render_strategy_table($content, r.message, level);
            } else {
                $content.html('<div class="text-center text-muted">No strategy defined for this level.</div>');
            }
        }
    });
}

function render_strategy_table($container, data, level) {
    const goals = data.goals || data;
    const config = get_level_config(level);
    const show_goal_actions = level !== "Individual";
    const show_status_bars = level === "Department";
    const latest_scorecard = (data.personal && data.personal.scorecards && data.personal.scorecards.length)
        ? data.personal.scorecards[0].name
        : null;
    const kpa_progress = {};
    if (show_status_bars && data.rollups && Array.isArray(data.rollups.kpas)) {
        data.rollups.kpas.forEach(kpa => {
            if (kpa && kpa.kpa) {
                kpa_progress[kpa.kpa] = kpa.average_score || 0;
            }
        });
    }
    if (!goals || !goals.length) {
        $container.html('<div class="text-center text-muted">No goals found.</div>');
        return;
    }

    let html = `
        <div class="table-responsive">
            <table class="table table-bordered table-hover strategy-table">
                <thead class="thead-light">
                    <tr>
                        <th style="width: 18%">KPA</th>
                        <th style="width: 32%">Goal</th>
                        <th style="width: ${config.show_kpi ? '30%' : '40%'}">KRA</th>
                        <th style="width: 15%">Progress</th>
                        ${show_goal_actions ? '<th style="width: 10%">Actions</th>' : ''}
                    </tr>
                </thead>
                <tbody>
    `;

    goals.forEach(goal => {
        let kras_html = goal.kras.map(k => {
            const kpi_html = (config.show_kpi && k.kpis && k.kpis.length) ? `
                <div class="kpi-list">
                    ${k.kpis.map(kpi => `
                        <div class="kpi-item clickable-kpi" data-name="${kpi.kpi}">
                            <div class="kpi-title">${kpi.kpi_name || kpi.kpi}</div>
                            <div class="kpi-meta-row">
                                <div class="kpi-meta">Target: ${kpi.target ?? '-'} | Actual: ${kpi.actual ?? '-'} | Score: ${kpi.score ?? '-'}</div>
                                ${latest_scorecard ? `<button class="btn btn-xs btn-light btn-update-kpi" data-kpi="${kpi.kpi}">Update</button>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : '';

            return `
                <div class="kra-item clickable-kra" data-name="${k.name}">
                    <div class="kra-row">
                        <div>
                            <strong>${k.kra_name}</strong>
                            ${k.weightage ? `<span class="badge badge-secondary">${k.weightage}%</span>` : ''}
                        </div>
                        <span class="text-muted small">${k.progress || 0}%</span>
                    </div>
                    <div class="progress ${show_status_bars ? 'kra-status-bar' : ''}" style="height: 6px; margin-top: 6px;">
                        <div class="progress-bar" role="progressbar" style="width: ${k.progress || 0}%" aria-valuenow="${k.progress || 0}" aria-valuemin="0" aria-valuemax="100"></div>
                    </div>
                    ${kpi_html}
                </div>
            `;
        }).join('');

        let parent_label = goal.parent_goal_name ? `<div class="small text-muted">Parent: ${goal.parent_goal_name}</div>` : '';
        let date_label = goal.start_date && goal.end_date ? `<div class="small text-muted">${goal.start_date} - ${goal.end_date}</div>` : '';

        const kpa_value = goal.kpa || '-';
        const kpa_score = kpa_progress[kpa_value] || 0;

        html += `
            <tr>
                <td>
                    <div class="kpa-cell">
                        <div class="kpa-name">${kpa_value}</div>
                        ${show_status_bars ? `
                            <div class="status-bar">
                                <div class="status-bar-track">
                                    <div class="status-bar-fill" style="width: ${kpa_score}%"></div>
                                </div>
                                <div class="status-bar-label">${kpa_score.toFixed(1)}%</div>
                            </div>
                        ` : ''}
                    </div>
                </td>
                <td>
                    <div class="clickable-goal" data-name="${goal.name}">${goal.goal_name}</div>
                    ${parent_label}
                    ${date_label}
                    ${show_status_bars ? `
                        <div class="status-bar goal-status">
                            <div class="status-bar-track">
                                <div class="status-bar-fill" style="width: ${goal.progress || 0}%"></div>
                            </div>
                            <div class="status-bar-label">${(goal.progress || 0).toFixed(1)}%</div>
                        </div>
                    ` : ''}
                </td>
                <td>${kras_html || '<span class="text-muted">No KRAs</span>'}</td>
                <td>
                    <div class="goal-progress-wrap">
                        <div class="progress-label">${goal.progress || 0}%</div>
                        <div class="progress" style="height: 10px; margin-top: 6px;">
                            <div class="progress-bar ${goal.progress >= 80 ? 'bg-success' : (goal.progress >= 50 ? 'bg-warning' : 'bg-danger')}" 
                                 role="progressbar" style="width: ${goal.progress || 0}%" 
                                 aria-valuenow="${goal.progress || 0}" aria-valuemin="0" aria-valuemax="100">
                            </div>
                        </div>
                    </div>
                </td>
                ${show_goal_actions ? `<td><button class="btn btn-xs btn-default btn-edit-goal" data-name="${goal.name}">Edit</button></td>` : ''}
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    $container.html(html);

    if (show_goal_actions) {
        $container.find('.clickable-goal, .btn-edit-goal').on('click', function () {
            let goal_name = $(this).data('name');
            edit_goal_dialog(goal_name, function () { load_strategy_data({ main: $container.parent().parent() }, level); });
        });
    }

    $container.find('.clickable-kra').on('click', function () {
        let kra_name = $(this).data('name');
        edit_kra_dialog(kra_name, function () { load_strategy_data({ main: $container.parent().parent() }, level); });
    });

    $container.find('.clickable-kpi').on('click', function () {
        let kpi_name = $(this).data('name');
        if (kpi_name) {
            frappe.set_route('Form', 'KPI Master', kpi_name);
        }
    });

    $container.find('.btn-update-kpi').on('click', function (e) {
        e.stopPropagation();
        const kpi_name = $(this).data('kpi');
        if (!latest_scorecard) {
            frappe.msgprint('Create a performance scorecard before updating KPI actuals.');
            return;
        }
        make_kpi_update_dialog(kpi_name, latest_scorecard, function () {
            load_strategy_data({ main: $container.parent().parent() }, level);
        });
    });
}

let employee_cache = null;
function get_current_employee() {
    if (employee_cache !== null) {
        return Promise.resolve(employee_cache);
    }

    return frappe.db.get_value('Employee', { user_id: frappe.session.user }, 'name').then(r => {
        employee_cache = (r && r.message && r.message.name) ? r.message.name : null;
        return employee_cache;
    });
}

function get_employee_department(employee) {
    if (!employee) {
        return Promise.resolve(null);
    }
    return frappe.db.get_value('Employee', employee, 'department').then(r => {
        return (r && r.message) ? r.message.department : null;
    });
}

function make_goal_dialog(level, callback) {
    const config = get_level_config(level);

    get_current_employee().then(employee => {
        get_employee_department(employee).then(department => {
            let d = new frappe.ui.Dialog({
                title: level === 'Company' ? 'Create Company Goal' : level === 'Department' ? 'Create Department Goal' : 'Create Personal Goal',
                fields: [
                    { label: 'Goal Name', fieldname: 'goal_name', fieldtype: 'Data', reqd: 1 },
                    {
                        label: 'Parent Goal',
                        fieldname: 'parent_goal',
                        fieldtype: 'Link',
                        options: 'Goal',
                        reqd: level !== 'Company',
                        hidden: level === 'Company',
                        get_query: () => ({
                            filters: { owner_type: level === 'Department' ? 'Company' : 'Department' }
                        })
                    },
                    { label: 'KPA', fieldname: 'kpa', fieldtype: 'Link', options: 'KPA Master', reqd: level === 'Company', read_only: level !== 'Company' },
                    { label: 'Weightage (%)', fieldname: 'weightage', fieldtype: 'Percent' },
                    { label: 'Start Date', fieldname: 'start_date', fieldtype: 'Date', default: frappe.datetime.get_today() },
                    { label: 'End Date', fieldname: 'end_date', fieldtype: 'Date' },
                    { label: 'Owner Type', fieldname: 'owner_type', fieldtype: 'Select', options: 'Company\nDepartment\nEmployee', default: config.owner_type, read_only: 1 },
                    { label: 'Employee', fieldname: 'employee', fieldtype: 'Link', options: 'Employee', default: employee, hidden: level !== 'Individual' },
                    { label: 'Department', fieldname: 'department', fieldtype: 'Link', options: 'Department', default: department, hidden: level !== 'Department' }
                ],
                primary_action_label: 'Create',
                primary_action(values) {
                    frappe.call({
                        method: 'frappe.client.insert',
                        args: {
                            doc: {
                                doctype: 'Goal',
                                ...values
                            }
                        },
                        callback: function (r) {
                            if (!r.exc) {
                                d.hide();
                                frappe.show_alert({ message: 'Goal Created', indicator: 'green' });
                                if (callback) callback();
                            }
                        }
                    });
                }
            });

            if (d.fields_dict.parent_goal) {
                d.fields_dict.parent_goal.$input.on('change', function () {
                    const parent_goal = d.get_value('parent_goal');
                    if (!parent_goal) {
                        return;
                    }
                    frappe.db.get_value('Goal', parent_goal, 'kpa').then(r => {
                        if (r && r.message && r.message.kpa) {
                            d.set_value('kpa', r.message.kpa);
                        }
                    });
                });
            }

            d.show();
        });
    });
}

function make_kra_dialog(level, callback) {
    const config = get_level_config(level);

    get_current_employee().then(employee => {
        get_employee_department(employee).then(department => {
            const goal_filters = { owner_type: config.owner_type };
            if (config.owner_type === 'Department' && department) {
                goal_filters.department = department;
            }
            if (config.owner_type === 'Employee' && employee) {
                goal_filters.employee = employee;
            }

            let d = new frappe.ui.Dialog({
                title: 'Create KRA',
                fields: [
                    { label: 'KRA Name', fieldname: 'kra_name', fieldtype: 'Data', reqd: 1 },
                    { label: 'Link to Goal', fieldname: 'goal', fieldtype: 'Link', options: 'Goal', reqd: 1, get_query: () => ({ filters: goal_filters }) },
                    { label: 'Weightage (%)', fieldname: 'weightage', fieldtype: 'Percent' },
                    { label: 'Priority', fieldname: 'priority', fieldtype: 'Select', options: 'Low\nMedium\nHigh', default: 'Medium' }
                ],
                primary_action_label: 'Create',
                primary_action(values) {
                    frappe.call({
                        method: 'frappe.client.insert',
                        args: {
                            doc: {
                                doctype: 'KRA',
                                ...values
                            }
                        },
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
        });
    });
}

function make_kpi_dialog(level, callback) {
    if (level !== 'Individual') {
        frappe.msgprint('KPIs can only be created at the individual level.');
        return;
    }

    get_current_employee().then(employee => {
        if (!employee) {
            frappe.msgprint('No Employee linked to your user.');
            return;
        }

        frappe.db.get_list('Goal', {
            fields: ['name'],
            filters: { owner_type: 'Employee', employee: employee }
        }).then(goals => {
            const goal_names = (goals || []).map(g => g.name);
            if (!goal_names.length) {
                frappe.msgprint('Create a personal goal before adding KPIs.');
                return;
            }

            const kra_filters = { goal: ['in', goal_names] };

            let d = new frappe.ui.Dialog({
                title: 'Create KPI',
                fields: [
                    { label: 'KPI Name', fieldname: 'kpi_name', fieldtype: 'Data', reqd: 1 },
                    { label: 'KRA', fieldname: 'kra', fieldtype: 'Link', options: 'KRA', reqd: 1, get_query: () => ({ filters: kra_filters }) },
                    { label: 'Unit', fieldname: 'unit', fieldtype: 'Select', options: 'Percentage\nCurrency\nCount\nRating' },
                    { label: 'Calculation Method', fieldname: 'calculation_method', fieldtype: 'Select', options: 'Manual\nSum\nAverage\nLast Value', default: 'Manual' },
                    { label: 'Default Green Threshold (>=)', fieldname: 'default_threshold_green', fieldtype: 'Float' },
                    { label: 'Default Yellow Threshold (>=)', fieldname: 'default_threshold_yellow', fieldtype: 'Float' },
                    { label: 'Description', fieldname: 'description', fieldtype: 'Small Text' }
                ],
                primary_action_label: 'Create',
                primary_action(values) {
                    frappe.call({
                        method: 'frappe.client.insert',
                        args: {
                            doc: {
                                doctype: 'KPI Master',
                                ...values
                            }
                        },
                        callback: function (r) {
                            if (!r.exc) {
                                d.hide();
                                frappe.show_alert({ message: 'KPI Created', indicator: 'green' });
                                if (callback) callback();
                            }
                        }
                    });
                }
            });

            d.show();
        });
    });
}

function make_kpi_update_dialog(kpi, scorecard, callback) {
    let d = new frappe.ui.Dialog({
        title: 'Update KPI Actual',
        fields: [
            { label: 'Actual Value', fieldname: 'actual_value', fieldtype: 'Float', reqd: 1 },
            { label: 'Comments', fieldname: 'comments', fieldtype: 'Small Text' }
        ],
        primary_action_label: 'Save',
        primary_action(values) {
            frappe.call({
                method: 'frappe.client.insert',
                args: {
                    doc: {
                        doctype: 'Performance Update',
                        scorecard: scorecard,
                        kpi: kpi,
                        actual_value: values.actual_value,
                        comments: values.comments
                    }
                },
                callback: function (r) {
                    if (!r.exc) {
                        d.hide();
                        frappe.show_alert({ message: 'KPI Updated', indicator: 'green' });
>>>>>>> origin/newton-manyisa
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
<<<<<<< HEAD
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
=======
            title: 'Edit Goal: ' + doc.goal_name,
            fields: [
                { label: 'Goal Name', fieldname: 'goal_name', fieldtype: 'Data', reqd: 1, default: doc.goal_name },
                { label: 'KPA', fieldname: 'kpa', fieldtype: 'Link', options: 'KPA Master', default: doc.kpa, read_only: 1 },
                { label: 'Weightage (%)', fieldname: 'weightage', fieldtype: 'Percent', default: doc.weightage },
                { label: 'Status', fieldname: 'status', fieldtype: 'Select', options: 'Draft\nActive\nCompleted\nArchived', default: doc.status },
                { label: 'Progress (%)', fieldname: 'progress', fieldtype: 'Percent', read_only: 1, default: doc.progress }
            ],
            primary_action_label: 'Update',
            primary_action(values) {
                frappe.call({
                    method: 'frappe.client.set_value',
                    args: {
                        doctype: 'Goal',
                        name: goal_name,
                        fieldname: values
                    },
                    callback: function (r) {
                        if (!r.exc) {
                            d.hide();
                            frappe.show_alert({ message: 'Goal Updated', indicator: 'green' });
>>>>>>> origin/newton-manyisa
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
<<<<<<< HEAD
                { label: 'Description', fieldname: 'description', fieldtype: 'Small Text', default: doc.description }
=======
                { label: 'Progress (%)', fieldname: 'progress', fieldtype: 'Percent', read_only: 1, default: doc.progress }
>>>>>>> origin/newton-manyisa
            ],
            primary_action_label: 'Update',
            primary_action(values) {
                frappe.call({
<<<<<<< HEAD
                    method: 'frappe.client.save',
                    args: { doc: { doctype: 'KRA', name: kra_name, ...values } },
=======
                    method: 'frappe.client.set_value',
                    args: {
                        doctype: 'KRA',
                        name: kra_name,
                        fieldname: values
                    },
>>>>>>> origin/newton-manyisa
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
<<<<<<< HEAD

// Real-time listener for refreshes
frappe.realtime.on('strategy_refresh', function (data) {
    if (frappe.get_route()[0] === 'strategy-plans') {
        let level = $('.btn-tab.active').data('level');
        load_strategy_data(frappe.pages['strategy-plans'], level);
    }
});
=======
>>>>>>> origin/newton-manyisa
