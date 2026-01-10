frappe.ui.form.on('Performance Scorecard', {
    refresh: function (frm) {
        set_item_queries(frm);
    },
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
        set_item_queries(frm);
    }
});

function set_item_queries(frm) {
    const employee = frm.doc.employee;

    frm.set_query('goal', 'items', function () {
        if (!employee) {
            return { filters: { owner_type: 'Employee', name: '' } };
        }
        return { filters: { owner_type: 'Employee', employee: employee } };
    });

    frm.set_query('kra', 'items', function () {
        if (!employee) {
            return { filters: { owner_type: 'Employee', name: '' } };
        }
        return { filters: { owner_type: 'Employee', employee: employee } };
    });

    frm.set_query('kpi', 'items', function () {
        if (!employee) {
            return { filters: { name: '' } };
        }
        return { filters: { employee: employee } };
    });
}
