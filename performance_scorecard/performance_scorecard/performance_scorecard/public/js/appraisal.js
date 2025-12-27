frappe.ui.form.on('Appraisal', {
    refresh: function (frm) {
        if (frm.doc.employee && frm.doc.docstatus === 0) {
            frm.add_custom_button(__('Fetch Scorecard'), function () {
                frappe.call({
                    method: 'performance_scorecard.performance_scorecard.doctype.performance_scorecard.performance_scorecard.get_scorecard_summary',
                    args: {
                        employee: frm.doc.employee,
                        end_date: frm.doc.end_date
                    },
                    callback: function (r) {
                        if (r.message) {
                            // Assuming Appraisal has a field for Scorecard Score or similar
                            // Since we can't modify Appraisal easily, we might just show a message or update a custom field if it exists
                            frappe.msgprint(__('Scorecard Score: {0}', [r.message.overall_score]));

                            // If we had a custom field, we would do:
                            // frm.set_value('custom_scorecard_score', r.message.overall_score);
                        } else {
                            frappe.msgprint(__('No approved scorecard found for this period.'));
                        }
                    }
                });
            });
        }
    }
});
