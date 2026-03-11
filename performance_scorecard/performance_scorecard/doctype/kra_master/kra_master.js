frappe.ui.form.on('KRA Master', {
    onload: function (frm) {
        set_goal_query(frm);
        set_parent_kra_query(frm);
        set_department_from_user(frm);
        set_employee_from_user(frm);
        set_department_requirements(frm);
    },
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
        sync_parent_kra_with_goal(frm);
    },
    parent_kra: function (frm) {
        sync_goal_with_parent_kra(frm);
    },
    owner_type: function (frm) {
        toggle_parent_kra(frm);
        set_department_from_user(frm);
        set_employee_from_user(frm);
        set_department_requirements(frm);
        set_goal_query(frm);
        set_parent_kra_query(frm);
    },
    department: function (frm) {
        if (frm.doc.owner_type === 'Department') {
            frm.set_value('goal', null);
            set_goal_query(frm);
        }
        set_parent_kra_query(frm);
    },
    employee: function (frm) {
        if (frm.doc.owner_type === 'Employee') {
            set_goal_query(frm);
            set_parent_kra_query(frm);
            sync_goal_with_parent_kra(frm);
        }
    }
});

function set_goal_query(frm) {
    if (!frm.fields_dict.goal) return;

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
    if (!frm.doc.goal) return;

    frappe.db.get_value('Goal Master', frm.doc.goal, ['owner_type', 'department', 'employee']).then(r => {
        const owner_type = r && r.message && r.message.owner_type;
        if (owner_type && frm.doc.owner_type !== owner_type) {
            frm.set_value('owner_type', owner_type);
        }
        const department = r && r.message && r.message.department;
        const employee = r && r.message && r.message.employee;
        if (department && frm.doc.department !== department) {
            frm.set_value('department', department);
        }
        if (employee && frm.doc.employee !== employee) {
            frm.set_value('employee', employee);
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
    if (!frm.fields_dict.parent_kra) return;

    if (frm.doc.owner_type !== 'Employee') {
        frm.set_query('parent_kra', () => ({ filters: { name: '' } }));
        return;
    }

    if (!frm.doc.goal) {
        if (frm.doc.department) {
            frm.set_query('parent_kra', () => ({
                query: "performance_scorecard.performance_scorecard.doctype.goal_master.goal_master.get_department_kra_query",
                filters: { department: frm.doc.department }
            }));
        } else {
            frm.set_query('parent_kra', () => ({ filters: { name: '' } }));
        }
        return;
    }

    frappe.db.get_value('Goal Master', frm.doc.goal, ['owner_type', 'parent_goal']).then(r => {
        if (!r || !r.message) return;

        if (r.message.owner_type !== 'Employee' || !r.message.parent_goal) {
            frm.set_query('parent_kra', () => ({ filters: { name: '' } }));
            return;
        }

        frm.set_query('parent_kra', () => ({
            filters: { owner_type: 'Department', goal: r.message.parent_goal }
        }));
    });
}

function set_department_from_user(frm) {
    if (!frm.fields_dict.department || frm.doc.department) return;

    frappe.db.get_value('Employee', { user_id: frappe.session.user }, 'department').then(r => {
        const dept = r && r.message && r.message.department;
        if (dept) {
            frm.set_value('department', dept);
            set_goal_query(frm);
            set_parent_kra_query(frm);
        }
    });
}

function set_department_requirements(frm) {
    if (!frm.fields_dict.department) return;
    const required = frm.doc.owner_type === 'Department';
    frm.set_df_property('department', 'reqd', required);
}

function set_employee_from_user(frm) {
    if (frm.doc.owner_type !== 'Employee' || !frm.fields_dict.employee || frm.doc.employee) return;

    frappe.db.get_value('Employee', { user_id: frappe.session.user }, 'name').then(r => {
        const employee = r && r.message && r.message.name;
        if (employee) {
            frm.set_value('employee', employee);
            set_goal_query(frm);
            if (frm.doc.parent_kra) {
                sync_goal_with_parent_kra(frm);
            }
        }
    });
}

function sync_parent_kra_with_goal(frm) {
    if (!frm.doc.goal || frm.doc.owner_type !== 'Employee') return;

    frappe.db.get_value('Goal Master', frm.doc.goal, 'parent_goal').then(r => {
        const parent_goal = r && r.message && r.message.parent_goal;
        if (!parent_goal) {
            if (frm.doc.parent_kra) {
                frm.set_value('parent_kra', null);
            }
            return;
        }

        const autofillParentKra = () => {
            if (frm.doc.parent_kra) {
                return;
            }
            frappe.call({
                method: 'performance_scorecard.performance_scorecard.doctype.goal_master.goal_master.get_linked_department_kra',
                args: { parent_goal: parent_goal }
            }).then(res => {
                const message = res && res.message;
                if (message && message.is_unique && message.name && message.name !== frm.doc.parent_kra) {
                    frm.set_value('parent_kra', message.name);
                }
            });
        };

        if (!frm.doc.parent_kra) {
            autofillParentKra();
            return;
        }

        frappe.db.get_value('KRA Master', frm.doc.parent_kra, 'goal').then(kr => {
            if (kr && kr.message && kr.message.goal !== parent_goal) {
                frm.set_value('parent_kra', null).then(() => autofillParentKra());
                return;
            }
            autofillParentKra();
        });
    });
}

function sync_goal_with_parent_kra(frm) {
    if (!frm.doc.parent_kra || frm.doc.owner_type !== 'Employee') return;

    frappe.call({
        method: 'performance_scorecard.performance_scorecard.doctype.goal_master.goal_master.get_employee_goal_for_parent_kra',
        args: {
            parent_kra: frm.doc.parent_kra,
            employee: frm.doc.employee
        }
    }).then(r => {
        const message = r && r.message;
        if (message && message.name && message.name !== frm.doc.goal) {
            frm.set_value('goal', message.name);
        }
    });
}
