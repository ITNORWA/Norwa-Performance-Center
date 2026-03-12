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
                    open_scorecard_tree_dialog(scorecard);
                });
            }, __('Actions'));
        }
    }
});

function fetch_scorecard_doc(frm, callback) {
    frappe.call({
        method: 'performance_scorecard.performance_scorecard.doctype.performance_scorecard.performance_scorecard.get_appraisal_scorecard_payload',
        args: {
            employee: frm.doc.employee,
            appraisal_start_date: frm.doc.start_date,
            appraisal_end_date: frm.doc.end_date
        },
        callback: function (r) {
            const scorecard = r.message;
            if (scorecard && scorecard.name) {
                if (callback) callback(scorecard);
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
    const items = (scorecard.items || []).filter(item => item && (item.kpi || item.kpi_name || item.kra || item.kra_name || item.goal || item.goal_name));
    let total_score_earned = 0;

    frm.clear_table('goals');

    items.forEach(item => {
        const row = frm.add_child('goals');
        const title = build_goal_title(item);
        const details = build_goal_details(item);
        const weightage = frappe.utils.flt(item.weightage);
        const score_out_of_five = percent_to_five(item.score);
        const score_earned = frappe.utils.flt(weightage * score_out_of_five / 5);

        total_score_earned += score_earned;

        set_if_present(row, child_fields, ['goal', 'goal_name'], title);
        set_if_present(row, child_fields, ['kra', 'key_result_area'], item.kra_name || item.goal_name || item.kpi_name || item.kra || item.goal || item.kpi);
        set_if_present(row, child_fields, ['per_weightage', 'weightage'], weightage);
        set_if_present(row, child_fields, ['score'], score_out_of_five);
        set_if_present(row, child_fields, ['score_earned'], score_earned);
        set_if_present(row, child_fields, ['remarks', 'description'], details);
    });

    update_appraisal_totals(frm, {
        overall_score_out_of_five: percent_to_five(scorecard.overall_score),
        total_score_earned: total_score_earned
    });

    frm.refresh_field('goals');
    frm.refresh_fields();
    frm.dirty();
    frappe.show_alert({
        message: __('Fetched {0} scorecard rows from {1}. Overall score: {2}/5. Feedback criteria were left unchanged.', [
            items.length,
            scorecard.name,
            percent_to_five(scorecard.overall_score).toFixed(2)
        ]),
        indicator: 'green'
    });
}

function update_appraisal_totals(frm, totals) {
    set_form_if_present(frm, ['total_score', 'total_goal_score', 'overall_score'], totals.overall_score_out_of_five);
    set_form_if_present(frm, ['total_score_earned', 'total_goal_score_earned'], totals.total_score_earned);
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

function set_form_if_present(frm, candidates, value) {
    const fieldname = candidates.find(candidate => frm.fields_dict && frm.fields_dict[candidate]);
    if (fieldname) {
        frm.set_value(fieldname, value);
    }
}

function percent_to_five(value) {
    const percent = frappe.utils.flt(value);
    return Math.max(0, Math.min(5, percent / 20));
}

function build_goal_title(item) {
    const kpi = item.kpi_name || item.kpi || __('Unnamed KPI');
    const kra = item.kra_name || item.kra || '';
    const goal = item.goal_name || item.goal || '';

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
    if (item.goal_name || item.goal) {
        parts.push(`Goal: ${item.goal_name || item.goal}`);
    }
    if (item.kra_name || item.kra) {
        parts.push(`KRA: ${item.kra_name || item.kra}`);
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

function open_scorecard_tree_dialog(scorecard) {
    const dialog = new frappe.ui.Dialog({
        title: __('Scorecard Tree'),
        size: 'extra-large',
        fields: [
            { fieldname: 'tree_html', fieldtype: 'HTML' }
        ]
    });

    dialog.get_field('tree_html').$wrapper.html(build_scorecard_tree_html(scorecard));
    dialog.show();
}

function build_scorecard_tree_html(scorecard) {
    const treeData = {};

    (scorecard.items || []).forEach(item => {
        const goal = item.goal_name || item.goal || 'Uncategorized Goal';
        const kra = item.kra_name || item.kra || 'Uncategorized KRA';

        if (!treeData[goal]) treeData[goal] = {};
        if (!treeData[goal][kra]) treeData[goal][kra] = [];

        treeData[goal][kra].push(item);
    });

    let html = `
    <style>
        .scorecard-tree { font-family: inherit; border: 1px solid #d1d8dd; border-radius: 6px; overflow: hidden; }
        .scorecard-tree-header { display: flex; background-color: #f3f6f8; font-weight: 600; padding: 10px 15px; border-bottom: 1px solid #d1d8dd; }
        .scorecard-tree-row { display: flex; padding: 8px 15px; border-bottom: 1px solid #e2e8ea; font-size: 13px; align-items: center; }
        .scorecard-tree-row:last-child { border-bottom: none; }
        .scorecard-tree-col-main { flex: 1; display: flex; align-items: center; }
        .scorecard-tree-col-score { width: 100px; text-align: right; font-weight: 600; }
        .scorecard-tree-col-meta { width: 160px; text-align: right; color: #6c7680; font-size: 12px; }
        .tree-level-goal { font-weight: 600; background-color: #fafbfc; }
        .tree-level-kra { padding-left: 30px; color: #36414c; background-color: #fff; }
        .tree-level-kpi { padding-left: 55px; color: #6c7680; background-color: #fff; }
        .scorecard-summary { padding: 12px 15px; background: #f8f9fa; display: flex; justify-content: space-between; font-weight: 600; }
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
        <div class="scorecard-summary">
            <span>Scorecard: ${scorecard.name || '-'}</span>
            <span>Overall: ${percent_to_five(scorecard.overall_score).toFixed(2)}/5</span>
        </div>
    </div>`;

    return html;
}
