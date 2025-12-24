frappe.pages['performance-dashboard'].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Performance Dashboard',
        single_column: true
    });

    page.set_primary_action('Refresh', function () {
        load_dashboard(page);
    });

    load_dashboard(page);
}

function load_dashboard(page) {
    $(page.body).empty();
    $(page.body).append('<div class="dashboard-content">Loading...</div>');

    frappe.call({
        method: "performance_scorecard.performance_scorecard.page.performance_dashboard.performance_dashboard.get_dashboard_data",
        callback: function (r) {
            if (r.message) {
                render_dashboard(page, r.message);
            }
        }
    });
}

function render_dashboard(page, data) {
    $(page.body).empty();

    // Example rendering
    let html = `
		<div class="row">
			<div class="col-md-12">
				<h3>Overall Score: ${data.overall_score || 0}</h3>
			</div>
		</div>
		<div class="row">
			<div class="col-md-6">
				<div class="chart-container" id="kpa-chart"></div>
			</div>
		</div>
	`;

    $(page.body).append(html);

    // Render Chart
    if (data.kpa_scores) {
        let chart_data = {
            labels: Object.keys(data.kpa_scores),
            datasets: [
                {
                    name: "Score",
                    values: Object.values(data.kpa_scores)
                }
            ]
        };

        new frappe.Chart("#kpa-chart", {
            title: "KPA Performance",
            data: chart_data,
            type: 'bar',
            height: 250,
            colors: ['#7cd6fd', '#743ee2']
        });
    }
}
