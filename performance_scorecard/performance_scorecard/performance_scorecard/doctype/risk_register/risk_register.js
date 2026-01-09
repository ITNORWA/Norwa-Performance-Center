// Copyright (c) 2024, Antigravity and contributors
// For license information, please see license.txt

frappe.ui.form.on('Risk Register', {
    refresh: function (frm) {
        frm.trigger('update_indicators');
    },

    likelihood: function (frm) {
        frm.trigger('calculate_score');
    },

    impact: function (frm) {
        frm.trigger('calculate_score');
    },

    calculate_score: function (frm) {
        if (frm.doc.likelihood && frm.doc.impact) {
            let likelihood = parseInt(frm.doc.likelihood.split(' - ')[0]);
            let impact = parseInt(frm.doc.impact.split(' - ')[0]);
            let score = likelihood * impact;

            frm.set_value('risk_score', score);

            let level = "Low";
            if (score >= 15) level = "High";
            else if (score >= 6) level = "Medium";

            frm.set_value('risk_level', level);
            frm.trigger('update_indicators');
        }
    },

    update_indicators: function (frm) {
        if (frm.doc.risk_level) {
            let color = "green";
            if (frm.doc.risk_level === "High") color = "red";
            else if (frm.doc.risk_level === "Medium") color = "orange";

            let res_color = "green";
            if (frm.doc.residual_risk_level === "High") res_color = "red";
            else if (frm.doc.residual_risk_level === "Medium") res_color = "orange";

            frm.dashboard.clear_headline();
            frm.dashboard.set_headline_alert(
                `<div class="row">
                    <div class="col-xs-6">
                        <span class="indicator ${color}">Inherent Risk: ${frm.doc.risk_level} (${frm.doc.risk_score})</span>
                    </div>
                    <div class="col-xs-6">
                        <span class="indicator ${res_color}">Residual Risk: ${frm.doc.residual_risk_level || 'N/A'} (${frm.doc.residual_risk_score || 0})</span>
                    </div>
                </div>`
            );
        }
    }
});

frappe.ui.form.on('Risk Treatment', {
    residual_likelihood: function (frm, cdt, cdn) {
        calculate_row_residual(frm, cdt, cdn);
    },
    residual_impact: function (frm, cdt, cdn) {
        calculate_row_residual(frm, cdt, cdn);
    }
});

function calculate_row_residual(frm, cdt, cdn) {
    let row = frappe.get_doc(cdt, cdn);
    if (row.residual_likelihood && row.residual_impact) {
        let l = parseInt(row.residual_likelihood.split(' - ')[0]);
        let i = parseInt(row.residual_impact.split(' - ')[0]);
        let score = l * i;

        frappe.model.set_value(cdt, cdn, 'residual_risk_score', score);

        let level = "Low";
        if (score >= 15) level = "High";
        else if (score >= 6) level = "Medium";

        frappe.model.set_value(cdt, cdn, 'residual_risk_level', level);

        // Update parent residual risk (take the latest row)
        frm.set_value('residual_risk_score', score);
        frm.set_value('residual_risk_level', level);
        frm.trigger('update_indicators');
    }
}
