frappe.listview_settings['Goal Master'] = {
	add_fields: ['owner_type', 'department', 'employee'],
	get_indicator: function (doc) {
		if (doc.owner_type === 'Company') {
			return ['Company Goal', 'green', 'owner_type,=,Company'];
		}
		if (doc.owner_type === 'Department') {
			return ['Department Goal', 'orange', 'owner_type,=,Department'];
		}
		return ['Employee Goal', 'blue', 'owner_type,=,Employee'];
	}
};
