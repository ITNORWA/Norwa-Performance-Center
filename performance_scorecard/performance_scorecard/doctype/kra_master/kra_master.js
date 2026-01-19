frappe.ui.form.on('KRA Master', {
    refresh: function (frm) {
        set_goal_query(frm);
        set_owner_type_from_goal(frm);
        set_parent_kra_query(frm);
        set_department_from_user(frm);
        set_employee_from_user(frm);
        set_department_requirements(frm);
    },
    goal: function (frm) {
        set_owner_type_from_goal(frm);
        set_parent_kra_query(frm);
    },
    owner_type: function (frm) {
        toggle_parent_kra(frm);
        set_department_from_user(frm);
        set_employee_from_user(frm);
        set_department_requirements(frm);
        set_goal_query(frm);
    },
    department: function (frm) {
        if (frm.doc.owner_type === 'Department') {
            frm.set_value('goal', null);
            set_goal_query(frm);
        }
    },
    employee: function (frm) {
        if (frm.doc.owner_type === 'Employee') {
            set_goal_query(frm);
        }
    }
});

function set_goal_query(frm) {
    if (!frm.fields_dict.goal) {
        return;
    }

    if (frm.doc.owner_type === 'Employee') {
        const employee = frm.doc.employee;
        if (!employee) {
            frm.set_query('goal', () => ({ filters: { owner_type: 'Employee', name: '' } }));
            return;
        }
        frm.set_query('goal', () => ({
            filters: { owner_type: 'Employee', employee: employee }
        }));
        return;
    }

    const dept = frm.doc.department;
    if (!dept) {
        frm.set_query('goal', () => ({ filters: { owner_type: 'Department', name: '' } }));
        return;
    }
    frm.set_query('goal', () => ({
        filters: { owner_type: 'Department', department: dept }
    }));
}

function set_owner_type_from_goal(frm) {
    if (!frm.doc.goal) {
        return;
    }

    frappe.db.get_value('Goal Master', frm.doc.goal, 'owner_type').then(r => {
        const owner_type = r && r.message && r.message.owner_type;
        if (owner_type && frm.doc.owner_type !== owner_type) {
            frm.set_value('owner_type', owner_type);
        }
        toggle_parent_kra(frm);
    });
}

function toggle_parent_kra(frm) {
    if (frm.doc.owner_type !== 'Employee' && frm.doc.parent_kra) {
        frm.set_value('parent_kra', null);
    }
}

function set_parent_kra_query(frm) {
    if (!frm.doc.goal || !frm.fields_dict.parent_kra) {
        return;
    }

    frappe.db.get_value('Goal Master', frm.doc.goal, ['owner_type', 'parent_goal']).then(r => {
        if (!r || !r.message) {
            return;
        }

        if (r.message.owner_type !== 'Employee' || !r.message.parent_goal) {
            frm.set_query('parent_kra', () => ({ filters: { name: '' } }));
            return;
        }

        frm.set_query('parent_kra', () => ({
            filters: { goal: r.message.parent_goal }
        }));
    });
}

function set_department_from_user(frm) {
    if (frm.doc.owner_type !== 'Department' || !frm.fields_dict.department) {
        return;
    }
    if (frm.doc.department) {
        return;
    }

    frappe.db.get_value('Employee', { user_id: frappe.session.user }, 'department').then(r => {
        const dept = r && r.message && r.message.department;
        if (dept) {
            frm.set_value('department', dept);
        }
    });
}

function set_department_requirements(frm) {
    if (!frm.fields_dict.department) {
        return;
    }
    const required = frm.doc.owner_type === 'Department';
    frm.set_df_property('department', 'reqd', required);
}

function set_employee_from_user(frm) {
    if (frm.doc.owner_type !== 'Employee' || !frm.fields_dict.employee) {
        return;
    }
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
