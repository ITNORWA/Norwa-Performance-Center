frappe.ui.form.on('Goal Master', {
    owner_type: function (frm) {
        if (frm.doc.owner_type == 'Company') {
            frm.set_value('employee', '');
            frm.set_value('department', '');
        }
        update_owner_fields(frm);
        set_department_from_user(frm);
        set_parent_goal_filters(frm);
        set_kpa_from_parent(frm);
    },
    parent_goal: function (frm) {
        set_kpa_from_parent(frm);
        set_parent_kra_filters(frm);
    },
    parent_kra: function (frm) {
        set_parent_goal_from_kra(frm);
    },
    employee: function (frm) {
        if (frm.doc.owner_type === 'Employee' && frm.doc.employee) {
            frappe.db.get_value('Employee', frm.doc.employee, 'department').then(r => {
                const dept = r && r.message && r.message.department;
                if (dept) {
                    frm.set_value('department', dept);
                    set_parent_kra_filters(frm);
                }
            });
        }
    },
    onload: function (frm) {
        update_owner_fields(frm);
        set_department_from_user(frm);
        set_parent_goal_filters(frm);
        set_parent_kra_filters(frm);
    },
    refresh: function (frm) {
        update_owner_fields(frm);
        set_department_from_user(frm);
        set_parent_kra_filters(frm);
    }
});

function update_owner_fields(frm) {
    const owner_type = frm.doc.owner_type;
    const show_parent_goal = owner_type !== 'Company';
    const show_parent_kra = owner_type === 'Employee';

    frm.set_df_property('parent_goal', 'hidden', !show_parent_goal);
    frm.set_df_property('parent_kra', 'hidden', !show_parent_kra);
    frm.refresh_field('parent_goal');
    frm.refresh_field('parent_kra');

    if (!show_parent_goal && frm.doc.parent_goal) {
        frm.set_value('parent_goal', null);
    }
    if (!show_parent_kra && frm.doc.parent_kra) {
        frm.set_value('parent_kra', null);
    }
}

function set_parent_goal_filters(frm) {
    if (!frm.fields_dict.parent_goal) {
        return;
    }

    let owner_type = frm.doc.owner_type;
    if (owner_type === 'Department') {
        frm.set_query('parent_goal', () => ({ filters: { owner_type: 'Company' } }));
    } else if (owner_type === 'Employee') {
        frm.set_query('parent_goal', () => ({ filters: { owner_type: 'Department' } }));
    } else {
        frm.set_query('parent_goal', () => ({}));
    }
}

function set_parent_kra_filters(frm) {
    if (!frm.fields_dict.parent_kra) return;

    if (frm.doc.parent_goal) {
        frm.set_query('parent_kra', () => ({
            filters: { goal: frm.doc.parent_goal }
        }));

        // Autofill if only one KRA exists for this goal
        if (!frm.doc.parent_kra && !frm.doc._fetching_kra) {
            frm.doc._fetching_kra = true;
            frappe.db.get_list('KRA Master', {
                filters: { goal: frm.doc.parent_goal },
                limit: 2
            }).then(res => {
                frm.doc._fetching_kra = false;
                if (res && res.length === 1) {
                    frm.set_value('parent_kra', res[0].name);
                }
            });
        }
    } else if (frm.doc.employee || frm.doc.department) {
        // If no goal selected, allow selecting any KRA from the department
        const dept = frm.doc.department;
        if (dept) {
            frm.set_query('parent_kra', () => {
                return {
                    query: "performance_scorecard.performance_scorecard.doctype.goal_master.goal_master.get_department_kra_query",
                    filters: { department: dept }
                };
            });
        } else if (frm.doc.employee) {
            // Fetch dept if missing
            frappe.db.get_value('Employee', frm.doc.employee, 'department').then(r => {
                const d = r && r.message && r.message.department;
                if (d) {
                    frm.set_value('department', d);
                    set_parent_kra_filters(frm);
                }
            });
        }
    }
}

function set_parent_goal_from_kra(frm) {
    if (!frm.doc.parent_kra || (frm.doc.parent_goal && !frm.doc._manually_changed_parent_goal)) return;

    frappe.db.get_value('KRA Master', frm.doc.parent_kra, 'goal').then(r => {
        if (r && r.message && r.message.goal && r.message.goal !== frm.doc.parent_goal) {
            frm.set_value('parent_goal', r.message.goal);
        }
    });
}

function set_kpa_from_parent(frm) {
    if (!frm.doc.parent_goal) {
        return;
    }

    frappe.db.get_value('Goal Master', frm.doc.parent_goal, 'kpa').then(r => {
        if (r && r.message && r.message.kpa) {
            frm.set_value('kpa', r.message.kpa);
        }
    });
}

function set_department_from_user(frm) {
    if (!frm.fields_dict.department) return;
    
    if (frm.doc.department) return;

    if (frm.doc.owner_type === 'Employee' && frm.doc.employee) {
        // Handled by employee trigger
        return;
    }

    frappe.db.get_value('Employee', { user_id: frappe.session.user }, 'department').then(r => {
        const dept = r && r.message && r.message.department;
        if (dept) {
            frm.set_value('department', dept);
            if (frm.doc.owner_type === 'Employee') {
                set_parent_kra_filters(frm);
            }
        }
    });
}
