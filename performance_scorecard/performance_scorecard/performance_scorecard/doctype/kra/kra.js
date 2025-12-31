frappe.ui.form.on('KRA', {
    refresh: function (frm) {
        set_owner_type_from_goal(frm);
        set_parent_kra_query(frm);
    },
    goal: function (frm) {
        set_owner_type_from_goal(frm);
        set_parent_kra_query(frm);
    },
    owner_type: function (frm) {
        toggle_parent_kra(frm);
    }
});

function set_owner_type_from_goal(frm) {
    if (!frm.doc.goal) {
        return;
    }

    frappe.db.get_value('Goal', frm.doc.goal, 'owner_type').then(r => {
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

    frappe.db.get_value('Goal', frm.doc.goal, ['owner_type', 'parent_goal']).then(r => {
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
