frappe.pages['strategy-plans'].on_page_load = function (wrapper) {
    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Strategy Plans',
        single_column: true
    });

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
        <div class="strategy-import" style="display: none;">
            <div class="import-card">
                <div class="import-card-header">Company Data Import</div>
                <div class="import-card-body">
                    <div class="import-section" data-section="kpa">
                        <div class="import-section-title">KPA Master</div>
                        <div class="import-controls">
                            <button class="btn btn-default btn-sm btn-upload" data-type="kpa">Upload CSV/XLSX</button>
                            <button class="btn btn-default btn-sm btn-template" data-type="kpa">Download Template</button>
                            <span class="import-file-name text-muted">No file selected</span>
                            <button class="btn btn-primary btn-sm btn-preview" data-type="kpa" disabled>Preview</button>
                            <button class="btn btn-success btn-sm btn-import" data-type="kpa" disabled>Import</button>
                        </div>
                        <div class="import-preview"></div>
                    </div>
                    <div class="import-section" data-section="goal">
                        <div class="import-section-title">Company Goals</div>
                        <div class="import-controls">
                            <button class="btn btn-default btn-sm btn-upload" data-type="goal">Upload CSV/XLSX</button>
                            <button class="btn btn-default btn-sm btn-template" data-type="goal">Download Template</button>
                            <span class="import-file-name text-muted">No file selected</span>
                            <button class="btn btn-primary btn-sm btn-preview" data-type="goal" disabled>Preview</button>
                            <button class="btn btn-success btn-sm btn-import" data-type="goal" disabled>Import</button>
                        </div>
                        <div class="import-preview"></div>
                    </div>
                </div>
            </div>
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

    setup_company_import(page, wrapper);

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
    let $import = page.main.find('.strategy-import');

    if (config.allow_goal || config.allow_kra || config.allow_kpi) {
        $actions.show();
        $actions.find('#btn-add-goal').toggle(!!config.allow_goal).text(level === 'Company' ? 'Add Company Goal' : level === 'Department' ? 'Add Department Goal' : 'Add Personal Goal');
        $actions.find('#btn-add-kra').toggle(!!config.allow_kra);
        $actions.find('#btn-add-kpi').toggle(!!config.allow_kpi);
    } else {
        $actions.hide();
    }

    if (level === 'Company') {
        $import.show();
    } else {
        $import.hide();
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
                        options: 'Goal Master',
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
                                doctype: 'Goal Master',
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
                    frappe.db.get_value('Goal Master', parent_goal, 'kpa').then(r => {
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
                    { label: 'Link to Goal', fieldname: 'goal', fieldtype: 'Link', options: 'Goal Master', reqd: 1, get_query: () => ({ filters: goal_filters }) },
                    { label: 'Weightage (%)', fieldname: 'weightage', fieldtype: 'Percent' },
                    { label: 'Priority', fieldname: 'priority', fieldtype: 'Select', options: 'Low\nMedium\nHigh', default: 'Medium' }
                ],
                primary_action_label: 'Create',
                primary_action(values) {
                    frappe.call({
                        method: 'frappe.client.insert',
                        args: {
                            doc: {
                                doctype: 'KRA Master',
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

        frappe.db.get_list('Goal Master', {
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
                    { label: 'KRA', fieldname: 'kra', fieldtype: 'Link', options: 'KRA Master', reqd: 1, get_query: () => ({ filters: kra_filters }) },
                    { label: 'Unit', fieldname: 'unit', fieldtype: 'Select', options: 'Percentage\nCurrency\nCount\nRating' },
                    { label: 'Direction', fieldname: 'direction', fieldtype: 'Select', options: 'Increase\nDecrease', default: 'Increase' },
                    { label: 'Baseline (Start Value)', fieldname: 'baseline', fieldtype: 'Float' },
                    { label: 'Calculation Method', fieldname: 'calculation_method', fieldtype: 'Select', options: 'Manual\nSum\nAverage\nLast Value', default: 'Manual' },
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
                        if (callback) callback();
                    }
                }
            });
        }
    });
    d.show();
}

function edit_goal_dialog(goal_name, callback) {
    frappe.db.get_doc('Goal Master', goal_name).then(doc => {
        let d = new frappe.ui.Dialog({
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
                        doctype: 'Goal Master',
                        name: goal_name,
                        fieldname: values
                    },
                    callback: function (r) {
                        if (!r.exc) {
                            d.hide();
                            frappe.show_alert({ message: 'Goal Updated', indicator: 'green' });
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
    frappe.db.get_doc('KRA Master', kra_name).then(doc => {
        let d = new frappe.ui.Dialog({
            title: 'Edit KRA: ' + doc.kra_name,
            fields: [
                { label: 'KRA Name', fieldname: 'kra_name', fieldtype: 'Data', reqd: 1, default: doc.kra_name },
                { label: 'Weightage (%)', fieldname: 'weightage', fieldtype: 'Percent', default: doc.weightage },
                { label: 'Priority', fieldname: 'priority', fieldtype: 'Select', options: 'Low\nMedium\nHigh', default: doc.priority },
                { label: 'Progress (%)', fieldname: 'progress', fieldtype: 'Percent', read_only: 1, default: doc.progress }
            ],
            primary_action_label: 'Update',
            primary_action(values) {
                frappe.call({
                    method: 'frappe.client.set_value',
                    args: {
                        doctype: 'KRA Master',
                        name: kra_name,
                        fieldname: values
                    },
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

function setup_company_import(page, wrapper) {
    wrapper.strategy_plans.import_state = {
        kpa: { file_url: null, preview: null },
        goal: { file_url: null, preview: null }
    };

    const $import = page.main.find('.strategy-import');

    $import.on('click', '.btn-upload', function () {
        const type = $(this).data('type');
        new frappe.ui.FileUploader({
            allow_multiple: false,
            restrictions: { allowed_file_types: ['.csv', '.xlsx', '.xls'] },
            on_success(file_doc) {
                const file_url = file_doc.file_url;
                wrapper.strategy_plans.import_state[type].file_url = file_url;
                wrapper.strategy_plans.import_state[type].preview = null;
                const $section = $import.find(`.import-section[data-section="${type}"]`);
                $section.find('.import-file-name').text(file_doc.file_name || file_url);
                $section.find('.btn-preview').prop('disabled', !file_url);
                $section.find('.btn-import').prop('disabled', true);
                $section.find('.import-preview').empty();
            }
        });
    });

    $import.on('click', '.btn-template', function () {
        const type = $(this).data('type');
        const method = type === 'kpa'
            ? 'performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.download_company_kpa_template'
            : 'performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.download_company_goal_template';
        const url = `/api/method/${method}?format=xlsx`;
        window.open(url, '_blank');
    });

    $import.on('click', '.btn-preview', function () {
        const type = $(this).data('type');
        const file_url = wrapper.strategy_plans.import_state[type].file_url;
        if (!file_url) {
            frappe.msgprint('Upload a file first.');
            return;
        }
        const method = type === 'kpa'
            ? 'performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.preview_company_kpa_import'
            : 'performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.preview_company_goal_import';
        const $section = $import.find(`.import-section[data-section="${type}"]`);
        $section.find('.import-preview').html('<div class="text-muted small">Generating preview...</div>');
        frappe.call({
            method: method,
            args: { file_url: file_url },
            callback: function (r) {
                if (r.message) {
                    wrapper.strategy_plans.import_state[type].preview = r.message;
                    render_import_preview($section.find('.import-preview'), r.message);
                    const has_valid = r.message.summary && r.message.summary.valid > 0;
                    $section.find('.btn-import').prop('disabled', !has_valid);
                } else {
                    $section.find('.import-preview').empty();
                    $section.find('.btn-import').prop('disabled', true);
                }
            }
        });
    });

    $import.on('click', '.btn-import', function () {
        const type = $(this).data('type');
        const file_url = wrapper.strategy_plans.import_state[type].file_url;
        if (!file_url) {
            frappe.msgprint('Upload a file first.');
            return;
        }
        const method = type === 'kpa'
            ? 'performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.import_company_kpa'
            : 'performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.import_company_goals';
        frappe.call({
            method: method,
            args: { file_url: file_url },
            callback: function (r) {
                if (r.message) {
                    const summary = r.message;
                    frappe.show_alert({
                        message: `Import complete. Created: ${summary.created || 0}, Updated: ${summary.updated || 0}, Skipped: ${summary.skipped || 0}`,
                        indicator: 'green'
                    });
                    load_strategy_data(page, 'Company');
                }
            }
        });
    });
}

function render_import_preview($container, preview) {
    const headers = preview.headers || [];
    const rows = preview.rows || [];
    const summary = preview.summary || {};

    if (!rows.length) {
        $container.html('<div class="text-muted small">No rows found in file.</div>');
        return;
    }

    let html = `
        <div class="import-summary text-muted small">
            Total: ${summary.total || 0} | Valid: ${summary.valid || 0} | Invalid: ${summary.invalid || 0}
        </div>
        <div class="table-responsive">
            <table class="table table-bordered table-sm import-table">
                <thead>
                    <tr>
                        ${headers.map(h => `<th>${frappe.utils.escape_html(h)}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(row => `
                        <tr class="${row.Status === 'Invalid' ? 'row-invalid' : 'row-valid'}">
                            ${headers.map(h => `<td>${frappe.utils.escape_html(row[h] ?? '')}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    $container.html(html);
}
