frappe.ui.form.on('Appraisal', {
    refresh: function (frm) {
        if (frm.doc.employee && frm.doc.docstatus === 0) {
            // Button 1: Fetch and Populate Appraisal Goals Table
            frm.add_custom_button(__('Fetch Scorecard'), function () {
                fetch_scorecard_doc(frm, function (scorecard) {
                    populate_appraisal_goals(frm, scorecard);
                });
            }, __('Actions'));

            // Button 2: View the Scorecard Hierarchy Tree
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
        method: 'frappe.client.get_value',
        args: {
            doctype: 'Performance Scorecard',
            filters: {
                employee: frm.doc.employee,
                end_date: ['<=', frm.doc.end_date],
                docstatus: 1
            },
            fieldname: 'name',
            order_by: 'end_date desc'
        },
        callback: function (r) {
            if (r.message && r.message.name) {
                frappe.model.with_doc('Performance Scorecard', r.message.name, function () {
                    let scorecard = frappe.get_doc('Performance Scorecard', r.message.name);
                    if (callback) callback(scorecard);
                });
            } else {
                frappe.msgprint(__('No approved scorecard found for this employee and period.'));
            }
        }
    });
}

function populate_appraisal_goals(frm, scorecard) {
    // Standard ERPNext Appraisal Goals table name is usually 'goals'
    // We will clear and repopulate it
    frm.clear_table('goals');

    (scorecard.items || []).forEach(item => {
        let row = frm.add_child('goals');
        // Mapping typical Scorecard fields to Appraisal Goals fields
        // Standard Appraisal Goal fields: goal_name, weightage, score, score_earned
        row.goal_name = item.kpi_name || item.kpi;
        row.weightage = item.weightage;
        row.score = item.score; // The score percentage from the scorecard

        // If Appraisal uses 'score_earned' or similar, we set it too
        // Standard ERPNext Appraisal logic uses weightage * score
    });

    frm.refresh_field('goals');
    frappe.show_alert({ message: __('Appraisal goals populated from Scorecard {0}', [scorecard.name]), indicator: 'green' });
}

function render_scorecard_tree(frm, scorecard) {
    let treeData = {};

    // Group by Goal -> KRA -> KPI
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
        .status-badge { padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-left: 8px; }
    </style>
    <div class="scorecard-tree">
        <div class="scorecard-tree-header">
            <div class="scorecard-tree-col-main">Hierarchy (Goal > KRA > KPI)</div>
            <div class="scorecard-tree-col-meta">Target / Actual</div>
            <div class="scorecard-tree-col-score">Score</div>
        </div>
    `;

    Object.keys(treeData).forEach(goal => {
        // Render Goal
        html += `
        <div class="scorecard-tree-row tree-level-goal">
            <div class="scorecard-tree-col-main"><i class="fa fa-folder-open text-muted mr-2"></i> ${goal}</div>
            <div class="scorecard-tree-col-meta"></div>
            <div class="scorecard-tree-col-score"></div>
        </div>`;

        Object.keys(treeData[goal]).forEach(kra => {
            // Render KRA
            html += `
            <div class="scorecard-tree-row tree-level-kra">
                <div class="scorecard-tree-col-main"><i class="fa fa-folder text-muted mr-2"></i> ${kra}</div>
                <div class="scorecard-tree-col-meta"></div>
                <div class="scorecard-tree-col-score"></div>
            </div>`;

            treeData[goal][kra].forEach(kpi => {
                // Render KPI
                let score = kpi.score !== undefined ? kpi.score.toFixed(1) + '%' : '-';
                let target = kpi.target !== undefined ? kpi.target : '-';
                let actual = (kpi.actual !== undefined && kpi.actual !== null) ? kpi.actual : '-';
                let scoreColor = kpi.score >= 90 ? 'text-success' : (kpi.score >= 50 ? 'text-warning' : 'text-danger');

                html += `
                <div class="scorecard-tree-row tree-level-kpi">
                    <div class="scorecard-tree-col-main"><i class="fa fa-file-text-o text-muted mr-2"></i> ${kpi.kpi}</div>
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
            <div class="scorecard-tree-col-score text-primary">${scorecard.overall_score !== undefined ? scorecard.overall_score.toFixed(1) + '%' : '-'}</div>
        </div>
    </div>`;

    $(frm.fields_dict.scorecard_tree_view.wrapper).html(html);
}
