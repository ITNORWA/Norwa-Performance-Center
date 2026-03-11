frappe.ui.form.on('Appraisal', {
    refresh: function (frm) {
        if (frm.doc.employee && frm.doc.docstatus === 0) {
            frm.add_custom_button(__('Fetch Scorecard'), function () {
                fetch_scorecard_doc(frm, function (scorecard) {
                    populate_appraisal_goals(frm, scorecard);
                });
            }, __('Actions'));

            frm.add_custom_button(__('View Scorecard Tree'), function () {
                fetch_scorecard_doc(frm, function (scorecard) {
                    if (frm.fields_dict.scorecard_tree_view) {
                        render_scorecard_tree(frm, scorecard);
                    } else {
                        frappe.msgprint(__('Please add an HTML field named "scorecard_tree_view" to see the tree.'));
                    }
                });
            }, __('Actions'));
        }
    }
});

function fetch_scorecard_doc(frm, callback) {
    frappe.call({
        method: 'performance_scorecard.performance_scorecard.doctype.performance_scorecard.performance_scorecard.get_appraisal_scorecard',
        args: {
            employee: frm.doc.employee,
            appraisal_start_date: frm.doc.start_date,
            appraisal_end_date: frm.doc.end_date
        },
        callback: function (r) {
            const scorecard_name = r.message;
            if (scorecard_name) {
                frappe.model.with_doc('Performance Scorecard', scorecard_name, function () {
                    const scorecard = frappe.get_doc('Performance Scorecard', scorecard_name);
                    if (callback) callback(scorecard);
                });
            } else {
                frappe.msgprint(__('No approved scorecard found for this employee and period.'));
            }
        }
    });
}

function populate_appraisal_goals(frm, scorecard) {
    if (!frm.fields_dict.goals) {
        frappe.msgprint(__('This Appraisal form does not have a goals table.'));
        return;
    }

    const goals_grid = frm.fields_dict.goals.grid;
    const child_doctype = goals_grid && goals_grid.doctype;
    const child_fields = get_child_fields(child_doctype);
    const items = (scorecard.items || []).filter(item => item && (item.kpi || item.kra || item.goal));

    frm.clear_table('goals');

    items.forEach(item => {
        const row = frm.add_child('goals');
        const title = build_goal_title(item);
        const details = build_goal_details(item);
        const weightage = frappe.utils.flt(item.weightage);
        const score = frappe.utils.flt(item.score);
        const score_earned = frappe.utils.flt(weightage * score / 100);

        set_if_present(row, child_fields, ['goal_name'], title);
        set_if_present(row, child_fields, ['kra', 'key_result_area'], item.kra || item.goal || item.kpi);
        set_if_present(row, child_fields, ['per_weightage', 'weightage'], weightage);
        set_if_present(row, child_fields, ['score'], score);
        set_if_present(row, child_fields, ['score_earned'], score_earned);
        set_if_present(row, child_fields, ['remarks', 'description'], details);
    });

    frm.refresh_field('goals');
    frm.dirty();
    frappe.show_alert({
        message: __('Fetched {0} scorecard rows from {1}. Feedback criteria were left unchanged.', [items.length, scorecard.name]),
        indicator: 'green'
    });
}

function get_child_fields(doctype) {
    const fields = new Set();
    if (!doctype) {
        return fields;
    }

    (frappe.meta.get_docfields(doctype) || []).forEach(df => {
        if (df && df.fieldname) {
            fields.add(df.fieldname);
        }
    });

    return fields;
}

function set_if_present(row, fields, candidates, value) {
    if (value === undefined || value === null || value === '') {
        return;
    }

    const fieldname = candidates.find(candidate => fields.has(candidate));
    if (fieldname) {
        row[fieldname] = value;
    }
}

function build_goal_title(item) {
    const kpi = item.kpi_name || item.kpi || __('Unnamed KPI');
    const kra = item.kra || '';
    const goal = item.goal || '';

    if (goal && kra) {
        return `${goal} / ${kra} / ${kpi}`;
    }
    if (kra) {
        return `${kra} / ${kpi}`;
    }
    if (goal) {
        return `${goal} / ${kpi}`;
    }
    return kpi;
}

function build_goal_details(item) {
    const parts = [];
    if (item.goal) {
        parts.push(`Goal: ${item.goal}`);
    }
    if (item.kra) {
        parts.push(`KRA: ${item.kra}`);
    }
    if (item.kpi_name || item.kpi) {
        parts.push(`KPI: ${item.kpi_name || item.kpi}`);
    }
    if (item.target !== undefined && item.target !== null) {
        parts.push(`Target: ${item.target}`);
    }
    if (item.actual !== undefined && item.actual !== null) {
        parts.push(`Actual: ${item.actual}`);
    }
    if (item.score !== undefined && item.score !== null) {
        parts.push(`Score: ${frappe.utils.flt(item.score).toFixed(1)}%`);
    }
    return parts.join(' | ');
}

function render_scorecard_tree(frm, scorecard) {
    let treeData = {};

    (scorecard.items || []).forEach(item => {
        let goal = item.goal || "Uncategorized Goal";
        let kra = item.kra || "Uncategorized KRA";

        if (!treeData[goal]) treeData[goal] = {};
        if (!treeData[goal][kra]) treeData[goal][kra] = [];

        treeData[goal][kra].push(item);
    });

    let html = `
    <style>
        .scorecard-tree { font-family: inherit; margin-top: 15px; border: 1px solid #d1d8dd; border-radius: 4px; overflow: hidden; }
        .scorecard-tree-header { display: flex; background-color: #f3f6f8; font-weight: bold; padding: 10px 15px; border-bottom: 1px solid #d1d8dd; }
        .scorecard-tree-row { display: flex; padding: 8px 15px; border-bottom: 1px solid #e2e8ea; font-size: 13px; align-items: center; }
        .scorecard-tree-row:last-child { border-bottom: none; }
        .scorecard-tree-col-main { flex: 1; display: flex; align-items: center; }
        .scorecard-tree-col-score { width: 80px; text-align: right; font-weight: bold; }
        .scorecard-tree-col-meta { width: 120px; text-align: right; color: #6c7680; font-size: 12px; }
        .tree-level-goal { font-weight: bold; background-color: #fafbfc; }
        .tree-level-kra { padding-left: 30px; color: #36414c; background-color: #fff; }
        .tree-level-kpi { padding-left: 55px; color: #6c7680; background-color: #fff; }
    </style>
    <div class="scorecard-tree">
        <div class="scorecard-tree-header">
            <div class="scorecard-tree-col-main">Hierarchy (Goal > KRA > KPI)</div>
            <div class="scorecard-tree-col-meta">Target / Actual</div>
            <div class="scorecard-tree-col-score">Score</div>
        </div>
    `;

    Object.keys(treeData).forEach(goal => {
        html += `
        <div class="scorecard-tree-row tree-level-goal">
            <div class="scorecard-tree-col-main"><i class="fa fa-folder-open text-muted mr-2"></i> ${goal}</div>
            <div class="scorecard-tree-col-meta"></div>
            <div class="scorecard-tree-col-score"></div>
        </div>`;

        Object.keys(treeData[goal]).forEach(kra => {
            html += `
            <div class="scorecard-tree-row tree-level-kra">
                <div class="scorecard-tree-col-main"><i class="fa fa-folder text-muted mr-2"></i> ${kra}</div>
                <div class="scorecard-tree-col-meta"></div>
                <div class="scorecard-tree-col-score"></div>
            </div>`;

            treeData[goal][kra].forEach(kpi => {
                const score = kpi.score !== undefined ? `${frappe.utils.flt(kpi.score).toFixed(1)}%` : '-';
                const target = kpi.target !== undefined ? kpi.target : '-';
                const actual = (kpi.actual !== undefined && kpi.actual !== null) ? kpi.actual : '-';
                const numeric_score = frappe.utils.flt(kpi.score);
                const scoreColor = numeric_score >= 90 ? 'text-success' : (numeric_score >= 50 ? 'text-warning' : 'text-danger');

                html += `
                <div class="scorecard-tree-row tree-level-kpi">
                    <div class="scorecard-tree-col-main"><i class="fa fa-file-text-o text-muted mr-2"></i> ${kpi.kpi_name || kpi.kpi}</div>
                    <div class="scorecard-tree-col-meta">${target} / ${actual}</div>
                    <div class="scorecard-tree-col-score ${scoreColor}">${score}</div>
                </div>`;
            });
        });
    });

    html += `
        <div class="scorecard-tree-header" style="background-color: #f8f9fa;">
            <div class="scorecard-tree-col-main" style="text-align: right; width: 100%;"><strong>Overall Scorecard Score:</strong></div>
            <div class="scorecard-tree-col-meta"></div>
            <div class="scorecard-tree-col-score text-primary">${scorecard.overall_score !== undefined ? frappe.utils.flt(scorecard.overall_score).toFixed(1) + '%' : '-'}</div>
        </div>
    </div>`;

    $(frm.fields_dict.scorecard_tree_view.wrapper).html(html);
}
