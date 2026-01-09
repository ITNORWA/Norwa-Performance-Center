frappe.ui.form.on('KPI Master', {
    refresh: function (frm) {
        set_employee_from_kra(frm);
    },
    kra: function (frm) {
        set_employee_from_kra(frm);
    }
});

function set_employee_from_kra(frm) {
    if (!frm.doc.kra) {
        frm.set_value('employee', null);
        return;
    }

    frappe.db.get_value('KRA', frm.doc.kra, 'goal').then(r => {
        const goal = r && r.message && r.message.goal;
        if (!goal) {
            frm.set_value('employee', null);
            return;
        }
        frappe.db.get_value('Goal', goal, 'employee').then(g => {
            const employee = g && g.message && g.message.employee;
            frm.set_value('employee', employee || null);
        });
    });
}
