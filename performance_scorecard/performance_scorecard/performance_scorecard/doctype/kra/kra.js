frappe.ui.form.on('KRA', {
    refresh: function (frm) {
        set_parent_kra_query(frm);
    },
    goal: function (frm) {
        set_parent_kra_query(frm);
    }
});

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
