frappe.ui.form.on('Goal', {
    owner_type: function (frm) {
        if (frm.doc.owner_type == 'Company') {
            frm.set_value('employee', '');
            frm.set_value('department', '');
        }
        set_parent_goal_filters(frm);
        set_kpa_from_parent(frm);
    },
    parent_goal: function (frm) {
        set_kpa_from_parent(frm);
    },
    employee: function (frm) {
        if (frm.doc.owner_type === 'Employee' && frm.doc.employee && !frm.doc.department) {
            frappe.db.get_value('Employee', frm.doc.employee, 'department').then(r => {
                if (r && r.message) {
                    frm.set_value('department', r.message.department);
                }
            });
        }
    },
    onload: function (frm) {
        set_parent_goal_filters(frm);
    }
});

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

function set_kpa_from_parent(frm) {
    if (!frm.doc.parent_goal) {
        return;
    }

    frappe.db.get_value('Goal', frm.doc.parent_goal, 'kpa').then(r => {
        if (r && r.message && r.message.kpa) {
            frm.set_value('kpa', r.message.kpa);
        }
    });
}
