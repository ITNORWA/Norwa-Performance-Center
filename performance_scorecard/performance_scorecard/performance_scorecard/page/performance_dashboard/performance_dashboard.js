frappe.pages['performance-dashboard'].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Performance Dashboard',
		single_column: true
	});

	render_sidebar(page);
	load_dashboard_data(page);
};

function render_sidebar(page) {
	let sidebar_html = `
        <div class="pc-sidebar">
            <div class="sidebar-header">
                <img src="/assets/performance_scorecard/images/performance_scorecard_logo.jpg" class="sidebar-logo">
                <span class="sidebar-title">Performance Center</span>
            </div>
            <nav class="sidebar-nav">
                <a href="/app/performance-dashboard" class="nav-item active">
                    <i class="fa fa-th-large"></i> Home
                </a>
                <a href="/app/strategy-plans" class="nav-item">
                    <i class="fa fa-map"></i> Strategy Plans
                </a>
                <a href="/app/strategy-maps" class="nav-item">
                    <i class="fa fa-sitemap"></i> Strategy Maps
                </a>
                <a href="/app/risk-dashboard" class="nav-item">
                    <i class="fa fa-warning"></i> Risk Management
                </a>
                <div class="nav-divider"></div>
                <a href="#" class="nav-item" id="nav-administration">
                    <i class="fa fa-cog"></i> Administration
                </a>
            </nav>
        </div>
    `;

	$(page.wrapper).find('.layout-side-section').remove();
	$(page.wrapper).find('.layout-main-section').before(sidebar_html);

	$(page.wrapper).find('#nav-administration').on('click', function (e) {
		e.preventDefault();
		frappe.set_route('Form', 'Performance Settings');
	});
}

function load_dashboard_data(page) {
	frappe.call({
		method: "performance_scorecard.performance_scorecard.page.performance_dashboard.performance_dashboard.get_dashboard_data",
		callback: function (r) {
			render_dashboard(page, r.message);
		}
	});
}

function render_dashboard(page, data) {
	let $container = $(page.main);
	$container.empty();

	let welcome_html = `
        <div class="dashboard-welcome d-flex justify-content-between align-items-center mb-4 p-4 bg-white shadow-sm rounded-lg">
            <div>
                <h2 class="mb-1 fw-bold text-dark">Welcome back, ${data.fullname} 👋</h2>
                <p class="text-muted mb-0">${data.designation} | ${data.company}</p>
            </div>
            <div class="dashboard-actions">
                <button class="btn btn-primary rounded-pill px-4" onclick="frappe.set_route('Form', 'Performance Update', 'new')">
                    <i class="fa fa-plus me-1"></i> Update Performance
                </button>
            </div>
        </div>
    `;
	$container.append(welcome_html);

	let grid_html = `
        <div class="dashboard-grid">
            <!-- Left Column: Primary Focus -->
            <div class="grid-main">
                <div class="row g-4">
                    <!-- Objectives Card -->
                    <div class="col-md-6">
                        <div class="card h-100 border-0 shadow-sm rounded-lg overflow-hidden">
                            <div class="card-header bg-white border-0 py-3 px-4 d-flex justify-content-between align-items-center">
                                <h5 class="mb-0 fw-bold"><i class="fa fa-bullseye text-primary me-2"></i> My Objectives</h5>
                                <span class="badge bg-light text-muted rounded-pill">${data.objectives.length}</span>
                            </div>
                            <div class="card-body p-0">
                                ${render_list_items(data.objectives, 'goal_name', 'progress', 'Goal')}
                            </div>
                        </div>
                    </div>

                    <!-- Key Results Card -->
                    <div class="col-md-6">
                        <div class="card h-100 border-0 shadow-sm rounded-lg overflow-hidden">
                            <div class="card-header bg-white border-0 py-3 px-4 d-flex justify-content-between align-items-center">
                                <h5 class="mb-0 fw-bold"><i class="fa fa-check-circle text-success me-2"></i> Key Results (KRAs)</h5>
                                <span class="badge bg-light text-muted rounded-pill">${data.key_results.length}</span>
                            </div>
                            <div class="card-body p-0">
                                ${render_list_items(data.key_results, 'kra_name', 'progress', 'KRA')}
                            </div>
                        </div>
                    </div>

                    <!-- Needs Attention Card -->
                    <div class="col-12">
                        <div class="card border-0 shadow-sm rounded-lg overflow-hidden">
                            <div class="card-header bg-white border-0 py-3 px-4 d-flex justify-content-between align-items-center">
                                <h5 class="mb-0 fw-bold"><i class="fa fa-exclamation-triangle text-danger me-2"></i> Needs Attention</h5>
                                <span class="badge bg-soft-danger text-danger rounded-pill">Low Scores</span>
                            </div>
                            <div class="card-body p-0">
                                ${render_attention_items(data.needs_attention)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Column: Activities & Tasks -->
            <div class="grid-side">
                <div class="row g-4">
                    <!-- Pending Tasks -->
                    <div class="col-12">
                        <div class="card border-0 shadow-sm rounded-lg overflow-hidden">
                            <div class="card-header bg-white border-0 py-3 px-4">
                                <h5 class="mb-0 fw-bold"><i class="fa fa-tasks text-info me-2"></i> Pending Updates</h5>
                            </div>
                            <div class="card-body p-3">
                                ${render_task_items(data.tasks)}
                            </div>
                        </div>
                    </div>

                    <!-- Recent Updates -->
                    <div class="col-12">
                        <div class="card border-0 shadow-sm rounded-lg overflow-hidden">
                            <div class="card-header bg-white border-0 py-3 px-4">
                                <h5 class="mb-0 fw-bold"><i class="fa fa-history text-muted me-2"></i> Recent History</h5>
                            </div>
                            <div class="card-body p-0">
                                ${render_history_items(data.recent_updates)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
	$container.append(grid_html);
}

function render_list_items(items, label_field, progress_field, doctype) {
	if (!items || items.length === 0) {
		return `<div class="p-4 text-center text-muted small">No active ${doctype}s found.</div>`;
	}

	return `
        <div class="list-group list-group-flush">
            ${items.map(item => `
                <div class="list-group-item p-3 border-0 border-bottom-light clickable-item" onclick="frappe.set_route('Form', '${doctype}', '${item.name}')">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="fw-semibold text-dark truncate-1" title="${item[label_field]}">${item[label_field]}</span>
                        <span class="small fw-bold ${item[progress_field] >= 80 ? 'text-success' : 'text-warning'}">${Math.round(item[progress_field])}%</span>
                    </div>
                    <div class="progress" style="height: 4px;">
                        <div class="progress-bar ${item[progress_field] >= 80 ? 'bg-success' : 'bg-warning'}" role="progressbar" style="width: ${item[progress_field]}%"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function render_attention_items(items) {
	if (!items || items.length === 0) {
		return `<div class="p-4 text-center text-muted small">All good! No performance issues detected.</div>`;
	}

	return `
        <table class="table table-hover mb-0 align-middle small">
            <thead class="bg-light">
                <tr>
                    <th class="ps-4">KPI Metric</th>
                    <th>Target</th>
                    <th>Actual</th>
                    <th class="pe-4">Score</th>
                </tr>
            </thead>
            <tbody>
                ${items.map(item => `
                    <tr class="clickable-item" onclick="frappe.set_route('Form', 'KPI Master', '${item.kpi}')">
                        <td class="ps-4 fw-bold text-danger">${item.kpi_name}</td>
                        <td>${item.target}</td>
                        <td>${item.actual}</td>
                        <td class="pe-4"><span class="badge bg-soft-danger text-danger rounded-pill px-2">${item.score}%</span></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function render_task_items(items) {
	if (!items || items.length === 0) {
		return `<div class="text-center text-muted small py-2">No pending drafts.</div>`;
	}

	return items.map(item => `
        <div class="p-2 mb-2 bg-light rounded d-flex justify-content-between align-items-center clickable-item" onclick="frappe.set_route('Form', 'Performance Update', '${item.name}')">
            <div class="small fw-semibold truncate-1">${item.kpi}</div>
            <i class="fa fa-chevron-right text-muted x-small"></i>
        </div>
    `).join('');
}

function render_history_items(items) {
	if (!items || items.length === 0) {
		return `<div class="p-4 text-center text-muted small">No update history.</div>`;
	}

	return `
        <div class="list-group list-group-flush">
            ${items.map(item => `
                <div class="list-group-item p-3 border-0 border-bottom-light small">
                    <div class="d-flex justify-content-between">
                        <span class="text-muted">${frappe.datetime.pretty_date(item.modified)}</span>
                        <span class="fw-bold text-primary">${item.actual_value}</span>
                    </div>
                    <div class="text-dark fw-semibold mt-1 truncate-1">${item.kpi_name}</div>
                </div>
            `).join('')}
        </div>
    `;
}

// Real-time listener for Home Dashboard
frappe.realtime.on('strategy_refresh', function (data) {
	if (frappe.get_route()[0] === 'performance-dashboard') {
		load_dashboard_data(frappe.pages['performance-dashboard']);
	}
});
