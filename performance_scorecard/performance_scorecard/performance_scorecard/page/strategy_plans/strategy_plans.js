frappe.pages['strategy-plans'].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Strategy Plans',
        single_column: true
    });

    // Add Tabs
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
        <div class="strategy-actions" style="margin-bottom: 15px; display: none;">
             <button class="btn btn-primary btn-sm" id="btn-add-goal">Add Goal</button>
             <button class="btn btn-default btn-sm" id="btn-add-kra">Add KRA</button>
        </div>
        <div class="strategy-content">
            <!-- Content will be loaded here -->
        </div>
    `);

    // Bind Tab Clicks
    page.main.find('.nav-link').on('click', function (e) {
        e.preventDefault();
        page.main.find('.nav-link').removeClass('active');
        $(this).addClass('active');
        let level = $(this).data('level');
        update_actions(page, level);
        load_strategy_data(page, level);
    });

    // Bind Action Buttons
    page.main.find('#btn-add-goal').on('click', function () {
        let level = page.main.find('.nav-link.active').data('level');
        make_goal_dialog(level, function () { load_strategy_data(page, level); });
    });

    page.main.find('#btn-add-kra').on('click', function () {
        let level = page.main.find('.nav-link.active').data('level');
        make_kra_dialog(level, function () { load_strategy_data(page, level); });
    });

    // Load default tab
    update_actions(page, "Company");
    load_strategy_data(page, "Company");
}

function update_actions(page, level) {
    let $actions = page.main.find('.strategy-actions');
    if (level === 'Department' || level === 'Company') {
        $actions.show();
        $actions.find('#btn-add-goal').text(level === 'Company' ? 'Add Company Goal' : 'Add Department Goal');
        if (level === 'Company') {
            $actions.find('#btn-add-kra').hide();
        } else {
            $actions.find('#btn-add-kra').show();
        }
    } else {
        $actions.hide();
    }
}

function load_strategy_data(page, level) {
    let $content = page.main.find('.strategy-content');
    $content.html('<div class="text-center text-muted">Loading...</div>');

    frappe.call({
        method: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.get_strategy_data",
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
    if (!goals || !goals.length) {
        $container.html('<div class="text-center text-muted">No goals found.</div>');
        return;
    }

    let html = `
        <div class="table-responsive">
            <table class="table table-bordered table-hover">
                <thead class="thead-light">
                    <tr>
                        <th style="width: 15%">KPA</th>
                        <th style="width: 25%">Goal</th>
                        <th style="width: 30%">KRA</th>
                        <th style="width: 20%">Progress</th>
                        <th style="width: 10%">Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;

    goals.forEach(goal => {
        let kras_html = goal.kras.map(k => `
            <div class="kra-item clickable-kra" data-name="${k.name}" style="margin-bottom: 5px; padding-bottom: 5px; border-bottom: 1px dashed #eee; cursor: pointer;">
                <div class="kra-row">
                    <div>
                        <strong>${k.kra_name}</strong> <span class="badge badge-secondary">${k.weightage}%</span>
                    </div>
                    <input type="number" class="form-control form-control-sm inline-progress-input" data-doctype="KRA" data-name="${k.name}" value="${k.progress || 0}" min="0" max="100" />
                </div>
                ${k.kpis && k.kpis.length ? `
                    <div class="kpi-list">
                        ${k.kpis.map(kpi => `
                            <div class="kpi-item">
                                <span>${kpi.kpi_name || kpi.kpi}</span>
                                <span class="text-muted small">Target: ${kpi.target ?? "-"} | Actual: ${kpi.actual ?? "-"}</span>
                            </div>
                        `).join("")}
                    </div>
                ` : ''}
                <div class="progress" style="height: 5px; margin-top: 6px;">
                    <div class="progress-bar" role="progressbar" style="width: ${k.progress || 0}%" aria-valuenow="${k.progress || 0}" aria-valuemin="0" aria-valuemax="100"></div>
                </div>
            </div>
        `).join('');

        html += `
            <tr>
                <td>${goal.kpa || '-'}</td>
                <td>
                    <div class="clickable-goal" data-name="${goal.name}" style="font-weight: bold; cursor: pointer; color: #007bff;">${goal.goal_name}</div>
                    <div class="small text-muted">${goal.start_date} - ${goal.end_date}</div>
                </td>
                <td>${kras_html || '<span class="text-muted">No KRAs</span>'}</td>
                <td>
                    <div class="goal-progress-wrap">
                        <input type="number" class="form-control form-control-sm inline-progress-input" data-doctype="Goal" data-name="${goal.name}" value="${goal.progress || 0}" min="0" max="100" />
                        <div class="progress" style="height: 10px; margin-top: 6px;">
                            <div class="progress-bar ${goal.progress >= 80 ? 'bg-success' : (goal.progress >= 50 ? 'bg-warning' : 'bg-danger')}" 
                                 role="progressbar" style="width: ${goal.progress || 0}%" 
                                 aria-valuenow="${goal.progress || 0}" aria-valuemin="0" aria-valuemax="100">
                            </div>
                        </div>
                    </div>
                </td>
                <td>
                    <button class="btn btn-xs btn-default btn-edit-goal" data-name="${goal.name}">Edit</button>
                </td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    $container.html(html);

    $container.find('.clickable-goal, .btn-edit-goal').on('click', function () {
        let goal_name = $(this).data('name');
        edit_goal_dialog(goal_name, function () { load_strategy_data({ main: $container.parent().parent() }, level); });
    });

    $container.find('.clickable-kra').on('click', function () {
        let kra_name = $(this).data('name');
        edit_kra_dialog(kra_name, function () { load_strategy_data({ main: $container.parent().parent() }, level); });
    });

    $container.find('.inline-progress-input').on('change', function (e) {
        e.stopPropagation();
        const $input = $(this);
        const doctype = $input.data('doctype');
        const name = $input.data('name');
        let value = flt($input.val() || 0);
        if (value < 0) value = 0;
        if (value > 100) value = 100;
        $input.val(value);

        frappe.call({
            method: 'frappe.client.set_value',
            args: {
                doctype: doctype,
                name: name,
                fieldname: 'progress',
                value: value
            },
            callback: function () {
                load_strategy_data({ main: $container.parent().parent() }, level);
            }
        });
    });
}

function make_goal_dialog(level, callback) {
    let department_default = frappe.defaults.get_user_default("Department");
    let d = new frappe.ui.Dialog({
        title: 'Create Goal',
        fields: [
            { label: 'Goal Name', fieldname: 'goal_name', fieldtype: 'Data', reqd: 1 },
            { label: 'KPA', fieldname: 'kpa', fieldtype: 'Link', options: 'KPA Master' },
            { label: 'Weightage (%)', fieldname: 'weightage', fieldtype: 'Percent' },
            { label: 'Start Date', fieldname: 'start_date', fieldtype: 'Date', default: frappe.datetime.get_today() },
            { label: 'End Date', fieldname: 'end_date', fieldtype: 'Date' },
            { label: 'Owner Type', fieldname: 'owner_type', fieldtype: 'Select', options: 'Company\nDepartment\nEmployee', default: level, read_only: 1 },
            { label: 'Department', fieldname: 'department', fieldtype: 'Link', options: 'Department', default: department_default, hidden: level !== 'Department' }
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
    d.show();
}

function make_kra_dialog(level, callback) {
    let d = new frappe.ui.Dialog({
        title: 'Create KRA',
        fields: [
            { label: 'KRA Name', fieldname: 'kra_name', fieldtype: 'Data', reqd: 1 },
            { label: 'Link to Goal', fieldname: 'goal', fieldtype: 'Link', options: 'Goal', reqd: 1, get_query: () => { return { filters: { owner_type: level } }; } },
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
}

function edit_goal_dialog(goal_name, callback) {
    frappe.db.get_doc('Goal', goal_name).then(doc => {
        let d = new frappe.ui.Dialog({
            title: 'Edit Goal: ' + doc.goal_name,
            fields: [
                { label: 'Goal Name', fieldname: 'goal_name', fieldtype: 'Data', reqd: 1, default: doc.goal_name },
                { label: 'KPA', fieldname: 'kpa', fieldtype: 'Link', options: 'KPA Master', default: doc.kpa },
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
                { label: 'Progress (%)', fieldname: 'progress', fieldtype: 'Percent', read_only: 1, default: doc.progress }
            ],
            primary_action_label: 'Update',
            primary_action(values) {
                frappe.call({
                    method: 'frappe.client.set_value',
                    args: {
                        doctype: 'KRA',
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
