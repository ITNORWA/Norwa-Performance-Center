frappe.ui.form.on('Goal', {
    owner_type: function (frm) {
        if (frm.doc.owner_type == 'Company') {
            frm.set_value('employee', '');
            frm.set_value('department', '');
        }
    }
});
