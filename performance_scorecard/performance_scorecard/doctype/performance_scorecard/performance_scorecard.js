frappe.ui.form.on('Performance Scorecard', {
    employee: function (frm) {
        if (frm.doc.employee) {
            frappe.call({
                'method': 'frappe.client.get_value',
                'args': {
                    'doctype': 'Employee',
                    'filters': { 'name': frm.doc.employee },
                    'fieldname': 'department'
                },
                'callback': function (r) {
                    if (r.message) {
                        frm.set_value('department', r.message.department);
                    }
                }
            });
        }
    }
});
