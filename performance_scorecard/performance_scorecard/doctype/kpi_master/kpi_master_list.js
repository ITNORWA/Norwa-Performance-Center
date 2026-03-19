frappe.listview_settings['KPI Master'] = {
	add_fields: ['status', 'employee'],
	get_indicator: function () {
		return ['Employee KPI', 'blue', 'status,=,Employee KPI'];
	}
};
