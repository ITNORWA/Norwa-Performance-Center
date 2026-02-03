frappe.listview_settings['KRA Master'] = {
	add_fields: ['owner_type', 'department', 'employee'],
	get_indicator: function (doc) {
		if (doc.owner_type === 'Department') {
			return ['Department KRA', 'orange', 'owner_type,=,Department'];
		}
		return ['Employee KRA', 'blue', 'owner_type,=,Employee'];
	}
};
