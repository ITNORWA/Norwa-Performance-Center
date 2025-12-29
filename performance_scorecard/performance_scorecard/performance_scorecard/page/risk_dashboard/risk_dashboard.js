frappe.pages['risk-dashboard'].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Risk Strategy Dashboard',
        single_column: true
    });

    page.set_primary_action('Refresh', function () {
        load_dashboard(page);
    });

    // Add CSS
    frappe.require('/assets/performance_scorecard/css/performance_dashboard.css');

    $(page.body).append(`
        <div class="dashboard-container">
            <div class="dashboard-kpis" id="risk-kpis">
                <!-- KPIs will be added here -->
            </div>
            
            <div class="dashboard-charts">
                <div class="chart-container">
                    <div class="chart-header">Risk Categories</div>
                    <div id="risk-categories-chart"></div>
                </div>
                <div class="chart-container">
                    <div class="chart-header">Risk Trend (New Risks)</div>
                    <div id="risk-trend-chart"></div>
                </div>
            </div>
            
            <div class="dashboard-charts">
                <div class="chart-container">
                    <div class="chart-header">Risks by Department</div>
                    <div id="risk-dept-chart"></div>
                </div>
                <div class="chart-container">
                    <div class="chart-header">Quick Links</div>
                    <div class="list-group list-group-flush">
                        <a href="/app/risk-register" class="list-group-item list-group-item-action">Risk Register</a>
                        <a href="/app/risk-heat-map" class="list-group-item list-group-item-action">Risk Heat Map</a>
                        <a href="/app/risk-context" class="list-group-item list-group-item-action">Risk Contexts</a>
                    </div>
                </div>
            </div>
        </div>
    `);

    load_dashboard(page);
}

function load_dashboard(page) {
    frappe.call({
        method: "performance_scorecard.performance_scorecard.page.risk_dashboard.risk_dashboard.get_dashboard_data",
        callback: function (r) {
            if (r.message) {
                render_kpis(r.message);
                render_charts(r.message);
            }
        }
    });
}

function render_kpis(data) {
    let $kpis = $('#risk-kpis');
    $kpis.empty();

    const kpi_list = [
        { label: 'Total Open Risks', value: data.total_open, color: 'blue' },
        { label: 'High Risks', value: data.high_risks, color: 'red' },
        { label: 'Appetite Breaches', value: data.appetite_breaches, color: 'orange' },
        { label: 'Overdue Reviews', value: data.overdue_reviews, color: 'yellow' }
    ];

    kpi_list.forEach(kpi => {
        $kpis.append(`
            <div class="kpi-card">
                <div class="kpi-value text-${kpi.color}">${kpi.value}</div>
                <div class="kpi-label">${kpi.label}</div>
            </div>
        `);
    });
}

function render_charts(data) {
    // 1. Categories Pie Chart
    new frappe.Chart("#risk-categories-chart", {
        data: {
            labels: data.categories.map(c => c.risk_category),
            datasets: [{ values: data.categories.map(c => c.count) }]
        },
        type: 'pie',
        height: 250,
        colors: ['#3182ce', '#38a169', '#e53e3e', '#d69e2e', '#805ad5']
    });

    // 2. Trend Line Chart
    new frappe.Chart("#risk-trend-chart", {
        data: {
            labels: data.trend.map(t => t.month),
            datasets: [{ values: data.trend.map(t => t.count) }]
        },
        type: 'line',
        height: 250,
        colors: ['#3182ce']
    });

    // 3. Dept Bar Chart
    new frappe.Chart("#risk-dept-chart", {
        data: {
            labels: data.departments.map(d => d.department || 'Unassigned'),
            datasets: [{ values: data.departments.map(d => d.count) }]
        },
        type: 'bar',
        height: 250,
        colors: ['#38a169']
    });
}
