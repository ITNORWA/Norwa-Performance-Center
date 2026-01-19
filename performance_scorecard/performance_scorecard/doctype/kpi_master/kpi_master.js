frappe.ui.form.on('KPI Master', {
    refresh: function (frm) {
        set_employee_from_user(frm);
        set_kra_query(frm);
        set_employee_from_kra(frm);
    },
    kra: function (frm) {
        set_employee_from_kra(frm);
    },
    employee: function (frm) {
        if (frm.doc.kra) {
            frm.set_value('kra', null);
        }
        set_kra_query(frm);
    }
});

function set_employee_from_kra(frm) {
    if (!frm.doc.kra) {
        return;
    }

    frappe.db.get_value('KRA Master', frm.doc.kra, ['employee', 'owner_type']).then(r => {
        const owner_type = r && r.message && r.message.owner_type;
        if (owner_type !== 'Employee') {
            frm.set_value('employee', null);
            return;
        }
        const employee = r && r.message && r.message.employee;
        if (employee) {
            frm.set_value('employee', employee);
        }
    });
}

function set_kra_query(frm) {
    if (!frm.fields_dict.kra) {
        return;
    }

    const employee = frm.doc.employee;
    if (!employee) {
        frm.set_query('kra', () => ({ filters: { owner_type: 'Employee', name: '' } }));
        return;
    }

    frm.set_query('kra', () => ({
        filters: { owner_type: 'Employee', employee: employee }
    }));
}

function set_employee_from_user(frm) {
    if (frm.doc.employee) {
        return;
    }

    frappe.db.get_value('Employee', { user_id: frappe.session.user }, 'name').then(r => {
        const employee = r && r.message && r.message.name;
        if (employee) {
            frm.set_value('employee', employee);
        }
    });
}
