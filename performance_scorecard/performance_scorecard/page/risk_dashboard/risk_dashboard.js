frappe.pages['risk-dashboard'].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: '',
        single_column: true
    });

    // Add CSS
    frappe.require('/assets/performance_scorecard/css/performance_dashboard.css', () => {
        load_dashboard(page);
    });
}

function load_dashboard(page) {
    $(page.body).empty();
    $(page.body).append('<div class="dashboard-content">Loading...</div>');

    frappe.call({
        method: "performance_scorecard.performance_scorecard.page.risk_dashboard.risk_dashboard.get_dashboard_data",
        callback: function (r) {
            if (r.message) {
                render_dashboard(page, r.message);
            }
        }
    });
}

function render_dashboard(page, data) {
    $(page.body).empty();

    // Fetch user info for sidebar
    const user = frappe.session.user;
    const fullname = frappe.session.user_fullname;

    let html = `
        <div class="dashboard-container">
            <!-- Sidebar -->
            <div class="dashboard-sidebar">
                <ul class="sidebar-menu">
                    <li data-section="home"><i class="fa fa-home"></i> Home</li>
                    <li data-section="strategy-plans"><i class="fa fa-list"></i> Strategy Plans</li>
                    <li data-section="strategy-maps"><i class="fa fa-sitemap"></i> Strategy Maps</li>
                    <li class="active" data-section="risk-management"><i class="fa fa-exclamation-triangle"></i> Risk Management</li>
                    <li data-section="dashboards"><i class="fa fa-tachometer"></i> Dashboards</li>
                    <li data-section="reports"><i class="fa fa-file-text"></i> Reports</li>
                    <li data-section="documentation"><i class="fa fa-book"></i> Documentation</li>
                    <li data-section="administration"><i class="fa fa-cog"></i> Administration</li>
                </ul>
                <div class="user-profile">
                    <div class="user-avatar">
                        <i class="fa fa-user"></i>
                    </div>
                    <div>
                        <div style="font-weight:bold; font-size:12px;">${fullname}</div>
                        <div style="font-size:10px; color:#a0aec0;">User</div>
                    </div>
                </div>
            </div>

            <!-- Main Content -->
            <div class="dashboard-main">
                <div class="dashboard-header">
                    <div class="page-title">Risk Strategy Dashboard</div>
                </div>

                <div class="dashboard-content-area">
                    <div class="dashboard-kpis" id="risk-kpis"></div>
                    
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
                            <div class="list-group list-group-flush" style="gap: 10px;">
                                <a href="/app/risk-register" class="list-group-item list-group-item-action" style="border-radius: 8px; border: 1px solid #edf2f7;">Risk Register</a>
                                <a href="/app/risk-heat-map" class="list-group-item list-group-item-action" style="border-radius: 8px; border: 1px solid #edf2f7;">Risk Heat Map</a>
                                <a href="/app/risk-context" class="list-group-item list-group-item-action" style="border-radius: 8px; border: 1px solid #edf2f7;">Risk Contexts</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    $(page.body).append(html);

    render_kpis(data);
    render_charts(data);
    bind_sidebar(page);
}

function render_kpis(data) {
    let $kpis = $('#risk-kpis');
    $kpis.empty();

    const kpi_list = [
        { label: 'Total Open Risks', value: data.total_open || 0, color: 'blue' },
        { label: 'High Risks', value: data.high_risks || 0, color: 'red' },
        { label: 'Appetite Breaches', value: data.appetite_breaches || 0, color: 'orange' },
        { label: 'Overdue Reviews', value: data.overdue_reviews || 0, color: 'yellow' }
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

function bind_sidebar(page) {
    const $body = $(page.body);
    $body.find(".sidebar-menu li").on("click", function () {
        const section = $(this).data("section");
        if (section === "home") {
            frappe.set_route("performance-dashboard");
        } else if (section === "strategy-plans") {
            frappe.set_route("performance-dashboard", { section: "strategy-plans" });
        } else if (section === "strategy-maps") {
            frappe.set_route("strategy-maps");
        } else if (section === "risk-management") {
            load_dashboard(page);
        } else if (section === "dashboards") {
            frappe.set_route("performance-dashboard", { section: "dashboards" });
        } else if (section === "reports") {
            frappe.set_route("performance-dashboard", { section: "reports" });
        } else if (section === "documentation") {
            frappe.set_route("performance-dashboard", { section: "documentation" });
        } else if (section === "administration") {
            frappe.set_route("performance-dashboard", { section: "administration" });
        } else {
            frappe.set_route("performance-dashboard");
        }
    });
}
