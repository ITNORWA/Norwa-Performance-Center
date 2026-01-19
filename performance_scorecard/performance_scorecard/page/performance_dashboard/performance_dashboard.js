frappe.pages['performance-dashboard'].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: '',
		single_column: true
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

	const home_html = build_home_html(data);

	let html = `
		<div class="dashboard-container">
			<!-- Sidebar -->
			<div class="dashboard-sidebar">
			<div class="sidebar-header">
				<h3 style="color:white; margin:0;">${data.company}</h3>
			</div>
				<ul class="sidebar-menu">
					<li class="active" data-section="home"><i class="fa fa-home"></i> Home</li>
					<li data-section="strategy-plans"><i class="fa fa-list"></i> Strategy Plans</li>
					<li data-section="strategy-maps"><i class="fa fa-sitemap"></i> Strategy Maps</li>
					<li data-section="risk-management"><i class="fa fa-exclamation-triangle"></i> Risk Management</li>
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
					<div style="font-weight:bold; font-size:12px;">${data.fullname}</div>
					<div style="font-size:10px; color:#a0aec0;">${data.designation}</div>
				</div>
			</div>
		</div>

		<!-- Main Content -->
		<div class="dashboard-main">
			<div class="dashboard-header">
				<div class="page-title">Home</div>
			</div>

				<div class="dashboard-content-area">
					${home_html}
				</div>
			</div>
		</div>
		`;

	$(page.body).append(html);

	$(page.body).off("click", ".home-link").on("click", ".home-link", function () {
		const doctype = $(this).data("doctype");
		const name = $(this).data("name");
		if (doctype && name) {
			open_doctype_modal(doctype, name);
		}
	});

	const url_params = new URLSearchParams(window.location.search || "");
	const route_opts = frappe.route_options || {};
	const initial_section = route_opts.section || url_params.get("section") || "home";
	frappe.route_options = null;

	bind_sidebar(page, data, home_html, initial_section);
	render_home_charts($(page.body), data);
}

function build_home_html(data) {
	return `
		<div class="home-charts-grid">
			<div class="dashboard-card">
				<div class="card-header blue">Company KPA Progress</div>
				<div class="chart-shell" id="home-kpa-company"></div>
			</div>
			<div class="dashboard-card">
				<div class="card-header light-blue">Department KPA Progress</div>
				<div class="chart-shell" id="home-kpa-department"></div>
			</div>
			<div class="dashboard-card">
				<div class="card-header yellow">Individual KPA Progress</div>
				<div class="chart-shell" id="home-kpa-individual"></div>
			</div>
		</div>
		<div class="home-summary-grid">
			<div class="dashboard-card">
				<div class="card-header red">Company At-Risk (${(data.attention_company || []).length})</div>
				<div class="card-content">
					${render_home_list(data.attention_company, "No company goals flagged.", { doctype: "Goal Master" })}
				</div>
			</div>
			<div class="dashboard-card">
				<div class="card-header yellow">Department At-Risk (${(data.attention_department || []).length})</div>
				<div class="card-content">
					${render_home_list(data.attention_department, "No department KRAs flagged.", { doctype: "KRA Master" })}
				</div>
			</div>
			<div class="dashboard-card">
				<div class="card-header cyan">Individual At-Risk (${(data.attention_individual || []).length})</div>
				<div class="card-content">
					${render_home_list(data.attention_individual, "No individual KRAs flagged.", { doctype: "KRA Master" })}
				</div>
			</div>
		</div>
			<div class="dashboard-card">
				<div class="card-header blue">Weekly Achievements</div>
				<div class="card-content">
					${render_home_list(data.weekly_top_kras, "No weekly achievements yet.", { doctype: "Goal Master" })}
				</div>
			</div>
			<div class="dashboard-card">
				<div class="card-header blue">Quarterly Achievements</div>
				<div class="card-content">
					${render_home_list(data.quarterly_top_kras, "No quarterly achievements yet.", { doctype: "Goal Master" })}
				</div>
			</div>
			<div class="dashboard-card">
				<div class="card-header light-blue">Pending Tasks</div>
				<div class="card-content">
					${render_task_list(data.tasks)}
				</div>
			</div>
		</div>
	`;
}

function bind_sidebar(page, data, home_html, initial_section) {
	const $body = $(page.body);
	const $content = $body.find(".dashboard-content-area");
	const $title = $body.find(".dashboard-header .page-title");
	const section_titles = {
		home: "Home",
		"strategy-plans": "Strategy Plans",
		"strategy-maps": "Strategy Maps",
		"risk-management": "Risk Management",
		dashboards: "Dashboards",
		reports: "Reports",
		documentation: "Documentation",
		administration: "Administration"
	};

	function render_section(section) {
		$body.find(".sidebar-menu li").removeClass("active");
		$body.find(`.sidebar-menu li[data-section="${section}"]`).addClass("active");
		$content.removeClass("strategy-map-only");
		$title.text(section_titles[section] || "Dashboard");

		if (section === "home") {
			$content.html(home_html);
			render_home_charts($body, data);
			return;
		}

		if (section === "strategy-plans") {
			render_strategy_plans($content);
			return;
		}

		if (section === "strategy-maps") {
			render_strategy_maps($content);
			return;
		}

		if (section === "risk-management") {
			render_risk_management($content);
			return;
		}

		if (section === "dashboards") {
			render_dashboards($content);
			return;
		}

		if (section === "reports") {
			render_reports($content);
			return;
		}

		if (section === "documentation") {
			render_documentation($content);
			return;
		}

		render_placeholder($content, "This section is coming soon.");
	}

	$body.find(".sidebar-menu li").on("click", function () {
		render_section($(this).data("section"));
	});

	render_section(initial_section || "home");
}

function render_home_charts($body, data) {
	const progress = data.kra_progress || {};
	const palette = data.kpa_palette || [];
	render_chart("#home-kpa-company", progress.company, "pie", { colors: palette, normalize: true });
	render_chart("#home-kpa-department", progress.department, "pie", { colors: palette, normalize: true });
	render_chart("#home-kpa-individual", progress.individual, "pie", { colors: palette, normalize: true });
}

function render_home_list(items, empty_text, options) {
	if (!items || !items.length) {
		return `<div class="empty-state">${empty_text}</div>`;
	}

	const doctype = (options && options.doctype) || null;
	return items.map(item => `
		<div class="list-item ${((item.doctype || doctype) && item.name) ? "home-link" : ""}" ${((item.doctype || doctype) && item.name) ? `data-doctype="${item.doctype || doctype}" data-name="${item.name}"` : ""}>
			<span>${truncate_words(item.label, 3)}</span>
			<span class="badge badge-green">${format_score(item.value)}%</span>
		</div>
	`).join("");
}

function truncate_words(text, max_words) {
	if (!text) {
		return "-";
	}
	const raw = frappe.utils.escape_html(String(text));
	const words = raw.split(/\s+/).filter(Boolean);
	if (words.length <= max_words) {
		return raw;
	}
	return `${words.slice(0, max_words).join(" ")}…`;
}

function render_task_list(items) {
	if (!items || !items.length) {
		return '<div class="empty-state">No pending tasks.</div>';
	}

	return items.map(item => `
		<div class="list-item home-link" data-doctype="Performance Update" data-name="${item.name}">
			<span>${item.kpi || item.name}</span>
			<span class="badge badge-yellow">${item.status || "Draft"}</span>
		</div>
	`).join("");
}

function render_placeholder($container, message) {
	$container.html(`<div class="empty-state">${message}</div>`);
}

function render_strategy_plans($container) {
	$container.html(`
		<div class="strategy-tabs" style="margin-bottom: 20px;">
			<ul class="nav nav-tabs">
				<li class="nav-item">
					<a class="nav-link active" data-level="Company" href="#">Company Strategy</a>
				</li>
				<li class="nav-item">
					<a class="nav-link" data-level="Department" href="#">Department Strategy</a>
				</li>
				<li class="nav-item">
					<a class="nav-link" data-level="Individual" href="#">My Performance</a>
				</li>
			</ul>
		</div>
		<div class="strategy-actions" style="margin-bottom: 15px; display: none;">
			<button class="btn btn-primary btn-sm" data-action="add-kpa">Add KPA</button>
			<button class="btn btn-primary btn-sm" data-action="add-goal">Add Goal</button>
			<button class="btn btn-default btn-sm" data-action="add-kra">Add KRA</button>
			<span class="strategy-filters">
				<span class="dept-filter strategy-filter">
					<span class="filter-control"></span>
				</span>
				<span class="employee-filter strategy-filter">
					<span class="filter-control"></span>
				</span>
				<button class="btn btn-default btn-sm filter-refresh" title="Reload Filters">
					<i class="fa fa-refresh"></i>
				</button>
			</span>
			<span class="strategy-actions-right">
				<button class="btn btn-default btn-sm" data-action="import-company">Import</button>
			</span>
		</div>
		<div class="strategy-content"></div>
	`);

	const $actions = $container.find(".strategy-actions");
	const $deptFilter = $actions.find(".dept-filter");
	const $employeeFilter = $actions.find(".employee-filter");
	const deptControl = frappe.ui.form.make_control({
		df: { fieldname: "department", fieldtype: "Link", options: "Department", label: "", placeholder: "Department" },
		parent: $deptFilter.find(".filter-control"),
		render_input: true
	});
	deptControl.refresh();

	const employeeControl = frappe.ui.form.make_control({
		df: {
			fieldname: "employee",
			fieldtype: "Link",
			options: "Employee",
			label: "",
			placeholder: "Employee ID",
			get_query: () => {
				const dept = deptControl.get_value();
				if (!dept) {
					return {};
				}
				return { filters: { department: dept } };
			}
		},
		parent: $employeeFilter.find(".filter-control"),
		render_input: true
	});
	employeeControl.refresh();

	$container.find(".nav-link").on("click", function (e) {
		e.preventDefault();
		$container.find(".nav-link").removeClass("active");
		$(this).addClass("active");
		const level = $(this).data("level");
		update_strategy_actions($actions, level);
		load_strategy_data($container, level, deptControl.get_value(), employeeControl.get_value());
	});

	update_strategy_actions($actions, "Company");
	load_strategy_data($container, "Company", null);

		$actions.find("[data-action='add-goal']").on("click", function () {
			open_doctype_modal("Goal Master");
		});
		$actions.find("[data-action='add-kra']").on("click", function () {
			open_doctype_modal("KRA Master");
		});
		$actions.find("[data-action='add-kpa']").on("click", function () {
			open_doctype_modal("KPA Master");
		});
		$actions.find("[data-action='import-company']").on("click", function () {
			const level = $container.find(".nav-link.active").data("level");
			const filters = $container.data("strategy-filters") || {};
			const department = filters.department || "";
			const employee = filters.employee || "";
			if (level === "Department" && !department) {
				frappe.msgprint("Select a department before importing.");
				return;
			}
			if (level === "Individual" && !employee) {
				frappe.msgprint("Select an employee before importing.");
				return;
			}
			open_strategy_import_dialog($container, level, department, employee);
		});
	deptControl.$input.on("change", function () {
		const level = $container.find(".nav-link.active").data("level");
		if (level === "Department") {
			load_strategy_data($container, "Department", deptControl.get_value());
			return;
		}
		if (level === "Individual") {
			employeeControl.set_value("");
			load_strategy_data($container, "Individual", deptControl.get_value(), employeeControl.get_value());
		}
	});

	employeeControl.$input.on("change", function () {
		const level = $container.find(".nav-link.active").data("level");
		if (level === "Individual") {
			load_strategy_data($container, "Individual", deptControl.get_value(), employeeControl.get_value());
		}
	});

	$actions.on("click", ".filter-refresh", function () {
		const level = $container.find(".nav-link.active").data("level");
		if (level === "Department") {
			load_strategy_data($container, "Department", deptControl.get_value());
			return;
		}
		if (level === "Individual") {
			load_strategy_data($container, "Individual", deptControl.get_value(), employeeControl.get_value());
		}
	});
}

function render_risk_management($container) {
	$container.html(`
		<div class="grid-container">
			<div class="dashboard-card">
				<div class="card-header red">RISK OVERVIEW</div>
				<div class="card-content">Loading risk data...</div>
			</div>
			<div class="dashboard-card">
				<div class="card-header blue">QUICK LINKS</div>
				<div class="card-content">
					<div class="list-item"><a href="/app/risk-dashboard">Risk Dashboard</a></div>
					<div class="list-item"><a href="/app/risk-register">Risk Register</a></div>
					<div class="list-item"><a href="/app/risk-heat-map">Risk Heat Map</a></div>
					<div class="list-item"><a href="/app/risk-context">Risk Contexts</a></div>
					<div class="list-item"><a href="/app/risk-treatment">Risk Treatments</a></div>
					<div class="list-item"><a href="/app/risk-decision">Risk Decisions</a></div>
				</div>
			</div>
			<div class="dashboard-card">
				<div class="card-header yellow">TOP RISK CATEGORIES</div>
				<div class="card-content">Loading...</div>
			</div>
			<div class="dashboard-card">
				<div class="card-header cyan">RISKS BY DEPARTMENT</div>
				<div class="card-content">Loading...</div>
			</div>
		</div>
	`);

	frappe.call({
		method: "performance_scorecard.performance_scorecard.page.risk_dashboard.risk_dashboard.get_dashboard_data",
		callback: function (r) {
			if (!r.message) {
				$container.find(".card-content").html("No risk data found.");
				return;
			}

			const data = r.message;
			const overview = `
				<div class="list-item">Total Open Risks <span class="badge badge-red">${data.total_open || 0}</span></div>
				<div class="list-item">High Risks <span class="badge badge-red">${data.high_risks || 0}</span></div>
				<div class="list-item">Appetite Breaches <span class="badge badge-yellow">${data.appetite_breaches || 0}</span></div>
				<div class="list-item">Overdue Reviews <span class="badge badge-yellow">${data.overdue_reviews || 0}</span></div>
			`;

			const categories = (data.categories || []).slice(0, 6);
			const categoryRows = categories.length
				? categories.map(c => `<div class="list-item">${c.risk_category || "Uncategorized"} <span class="badge badge-green">${c.count || 0}</span></div>`).join("")
				: '<div class="empty-state">No open risks found.</div>';

			const departments = (data.departments || []).slice(0, 6);
			const deptRows = departments.length
				? departments.map(d => `<div class="list-item">${d.department || "Unassigned"} <span class="badge badge-green">${d.count || 0}</span></div>`).join("")
				: '<div class="empty-state">No department data yet.</div>';

			const $cards = $container.find(".dashboard-card");
			$cards.eq(0).find(".card-content").html(overview);
			$cards.eq(2).find(".card-content").html(categoryRows);
			$cards.eq(3).find(".card-content").html(deptRows);
		}
	});
}

function load_strategy_data($container, level, department, employee) {
	const $content = $container.find(".strategy-content");
	$content.html('<div class="text-center text-muted">Loading...</div>');
	$container.data("strategy-filters", {
		department: department || "",
		employee: employee || ""
	});

	frappe.call({
		method: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.get_strategy_data",
		args: { level: level, department: department, employee: employee },
		callback: function (r) {
			if (r.message) {
				const payload = r.message;
				if (payload.meta && payload.meta.level === "Individual") {
					render_personal_panel($container, payload.personal || { scorecards: [], updates: [] }, payload.rollups || {}, payload.goals || []);
					render_personal_tables($content, payload, $container);
					load_weekly_commitments($content, payload.meta && payload.meta.employee);
				} else if (payload.meta && payload.meta.level === "Company" && payload.company) {
					$container.find(".personal-actions, .personal-summaries").remove();
					$content.empty();
					render_company_strategy($content, payload.company);
				} else {
					$container.find(".personal-actions, .personal-summaries").remove();
					$content.empty();
					render_strategy_table($content, payload.goals || payload, payload.rollups || {}, payload.meta && payload.meta.level);
				}
			} else {
				$content.html('<div class="text-center text-muted">No strategy defined for this level.</div>');
			}
		}
	});
}

function update_strategy_actions($actions, level) {
	if (level === "Company" || level === "Department") {
		$actions.show();
		if (level === "Company") {
			$actions.find("[data-action='add-goal']").text("Add Company Goal").show();
			$actions.find("[data-action='add-kpa']").show();
			$actions.find("[data-action='add-kra']").hide();
			$actions.find(".dept-filter").hide();
			$actions.find(".employee-filter").hide();
			$actions.find(".strategy-filters").hide();
			$actions.find("[data-action='import-company']").show();
		} else {
			$actions.find("[data-action='add-goal']").text("Add Department Goal").show();
			$actions.find("[data-action='add-kra']").show();
			$actions.find("[data-action='add-kpa']").hide();
			$actions.find(".dept-filter").show();
			$actions.find(".employee-filter").hide();
			$actions.find(".strategy-filters").show();
			$actions.find("[data-action='import-company']").show();
		}
	} else {
		$actions.show();
		$actions.find("[data-action='add-goal']").hide();
		$actions.find("[data-action='add-kra']").hide();
		$actions.find("[data-action='add-kpa']").hide();
		$actions.find(".dept-filter").show();
		$actions.find(".employee-filter").show();
		$actions.find(".strategy-filters").show();
		$actions.find("[data-action='import-company']").show();
	}
}

function open_strategy_import_dialog($container, level, department, employee) {
	const title = level === "Department" ? "Department Data Import" : "Company Data Import";
	const dialog_title = level === "Individual" ? "Employee Data Import" : title;
	const dialog = new frappe.ui.Dialog({
		title: dialog_title,
		size: "large",
		fields: [{ fieldname: "import_html", fieldtype: "HTML" }]
	});
	const $wrapper = dialog.get_field("import_html").$wrapper;
	$wrapper.html(build_strategy_import_html(level));
	setup_strategy_import_scope($wrapper, $container, level, department, employee);
	dialog.show();
}

function build_strategy_import_html(level) {
	if (level === "Department") {
		return `
			<div class="strategy-import">
				<div class="import-card">
					<div class="import-card-header">Department Data Import</div>
					<div class="import-card-body">
						<div class="import-section" data-section="goal">
							<div class="import-section-title">Department Goals</div>
							<div class="import-controls">
								<button class="btn btn-default btn-sm btn-upload" data-type="goal">Upload CSV/XLSX</button>
								<button class="btn btn-default btn-sm btn-template" data-type="goal">Download Template</button>
								<button class="btn btn-default btn-sm btn-export" data-type="goal">Export</button>
								<span class="import-file-name text-muted">No file selected</span>
								<button class="btn btn-primary btn-sm btn-preview" data-type="goal" disabled>Preview</button>
								<button class="btn btn-success btn-sm btn-import" data-type="goal" disabled>Import</button>
							</div>
							<div class="import-preview"></div>
						</div>
						<div class="import-section" data-section="kra">
							<div class="import-section-title">Department KRAs</div>
							<div class="import-controls">
								<button class="btn btn-default btn-sm btn-upload" data-type="kra">Upload CSV/XLSX</button>
								<button class="btn btn-default btn-sm btn-template" data-type="kra">Download Template</button>
								<button class="btn btn-default btn-sm btn-export" data-type="kra">Export</button>
								<span class="import-file-name text-muted">No file selected</span>
								<button class="btn btn-primary btn-sm btn-preview" data-type="kra" disabled>Preview</button>
								<button class="btn btn-success btn-sm btn-import" data-type="kra" disabled>Import</button>
							</div>
							<div class="import-preview"></div>
						</div>
					</div>
				</div>
			</div>
		`;
	}

	if (level === "Individual") {
		return `
			<div class="strategy-import">
				<div class="import-card">
					<div class="import-card-header">Employee Data Import</div>
					<div class="import-card-body">
						<div class="import-section" data-section="goal">
							<div class="import-section-title">Employee Goals</div>
							<div class="import-controls">
								<button class="btn btn-default btn-sm btn-upload" data-type="goal">Upload CSV/XLSX</button>
								<button class="btn btn-default btn-sm btn-template" data-type="goal">Download Template</button>
								<button class="btn btn-default btn-sm btn-export" data-type="goal">Export</button>
								<span class="import-file-name text-muted">No file selected</span>
								<button class="btn btn-primary btn-sm btn-preview" data-type="goal" disabled>Preview</button>
								<button class="btn btn-success btn-sm btn-import" data-type="goal" disabled>Import</button>
							</div>
							<div class="import-preview"></div>
						</div>
						<div class="import-section" data-section="kra">
							<div class="import-section-title">Employee KRAs</div>
							<div class="import-controls">
								<button class="btn btn-default btn-sm btn-upload" data-type="kra">Upload CSV/XLSX</button>
								<button class="btn btn-default btn-sm btn-template" data-type="kra">Download Template</button>
								<button class="btn btn-default btn-sm btn-export" data-type="kra">Export</button>
								<span class="import-file-name text-muted">No file selected</span>
								<button class="btn btn-primary btn-sm btn-preview" data-type="kra" disabled>Preview</button>
								<button class="btn btn-success btn-sm btn-import" data-type="kra" disabled>Import</button>
							</div>
							<div class="import-preview"></div>
						</div>
						<div class="import-section" data-section="kpi">
							<div class="import-section-title">Employee KPIs</div>
							<div class="import-controls">
								<button class="btn btn-default btn-sm btn-upload" data-type="kpi">Upload CSV/XLSX</button>
								<button class="btn btn-default btn-sm btn-template" data-type="kpi">Download Template</button>
								<button class="btn btn-default btn-sm btn-export" data-type="kpi">Export</button>
								<span class="import-file-name text-muted">No file selected</span>
								<button class="btn btn-primary btn-sm btn-preview" data-type="kpi" disabled>Preview</button>
								<button class="btn btn-success btn-sm btn-import" data-type="kpi" disabled>Import</button>
							</div>
							<div class="import-preview"></div>
						</div>
					</div>
				</div>
			</div>
		`;
	}

	return `
		<div class="strategy-import">
			<div class="import-card">
				<div class="import-card-header">Company Data Import</div>
				<div class="import-card-body">
					<div class="import-section" data-section="kpa">
							<div class="import-section-title">KPA Master</div>
							<div class="import-controls">
								<button class="btn btn-default btn-sm btn-upload" data-type="kpa">Upload CSV/XLSX</button>
								<button class="btn btn-default btn-sm btn-template" data-type="kpa">Download Template</button>
								<button class="btn btn-default btn-sm btn-export" data-type="kpa">Export</button>
								<span class="import-file-name text-muted">No file selected</span>
								<button class="btn btn-primary btn-sm btn-preview" data-type="kpa" disabled>Preview</button>
								<button class="btn btn-success btn-sm btn-import" data-type="kpa" disabled>Import</button>
						</div>
						<div class="import-preview"></div>
					</div>
					<div class="import-section" data-section="goal">
							<div class="import-section-title">Company Goals</div>
							<div class="import-controls">
								<button class="btn btn-default btn-sm btn-upload" data-type="goal">Upload CSV/XLSX</button>
								<button class="btn btn-default btn-sm btn-template" data-type="goal">Download Template</button>
								<button class="btn btn-default btn-sm btn-export" data-type="goal">Export</button>
								<span class="import-file-name text-muted">No file selected</span>
								<button class="btn btn-primary btn-sm btn-preview" data-type="goal" disabled>Preview</button>
								<button class="btn btn-success btn-sm btn-import" data-type="goal" disabled>Import</button>
						</div>
						<div class="import-preview"></div>
					</div>
				</div>
			</div>
		</div>
	`;
}

function setup_strategy_import_scope($scope, $container, level, department, employee) {
	const import_state = {};
	const $import = $scope.find(".strategy-import");
	const method_map = get_import_method_map(level);

	$import.on("click", ".btn-upload", function () {
		const type = $(this).data("type");
		new frappe.ui.FileUploader({
			allow_multiple: false,
			restrictions: { allowed_file_types: [".csv", ".xlsx", ".xls"] },
			on_success(file_doc) {
				const file_url = file_doc.file_url;
				import_state[type] = { file_url: file_url, preview: null };
				const $section = $import.find(`.import-section[data-section="${type}"]`);
				$section.find(".import-file-name").text(file_doc.file_name || file_url);
				$section.find(".btn-preview").prop("disabled", !file_url);
				$section.find(".btn-import").prop("disabled", true);
				$section.find(".import-preview").empty();
			}
		});
	});

	$import.on("click", ".btn-template", function () {
		const type = $(this).data("type");
		const method = method_map[type].template;
		const url = `/api/method/${method}?format=xlsx`;
		window.open(url, "_blank");
	});

	$import.on("click", ".btn-export", function () {
		const type = $(this).data("type");
		const method = method_map[type].exporter;
		if (!method) {
			return;
		}
		if (level === "Department" && !department) {
			frappe.msgprint("Select a department before exporting.");
			return;
		}
		if (level === "Individual" && !employee) {
			frappe.msgprint("Select an employee before exporting.");
			return;
		}
		let url = `/api/method/${method}?format=xlsx`;
		if (level === "Department" && department) {
			url += `&department=${encodeURIComponent(department)}`;
		}
		if (level === "Individual" && employee) {
			url += `&employee=${encodeURIComponent(employee)}`;
		}
		window.open(url, "_blank");
	});

	$import.on("click", ".btn-preview", function () {
		const type = $(this).data("type");
		const state = import_state[type] || {};
		const file_url = state.file_url;
		if (!file_url) {
			frappe.msgprint("Upload a file first.");
			return;
		}
		const $section = $import.find(`.import-section[data-section="${type}"]`);
		$section.find(".import-preview").html('<div class="text-muted small">Generating preview...</div>');
		const args = { file_url: file_url };
		if (level === "Department") {
			args.department = department;
		}
		if (level === "Individual") {
			args.employee = employee;
		}
		frappe.call({
			method: method_map[type].preview,
			args: args,
			callback: function (r) {
				if (r.message) {
					state.preview = r.message;
					render_import_preview($section.find(".import-preview"), r.message);
					const has_valid = r.message.summary && r.message.summary.valid > 0;
					$section.find(".btn-import").prop("disabled", !has_valid);
				} else {
					$section.find(".import-preview").empty();
					$section.find(".btn-import").prop("disabled", true);
				}
			}
		});
	});

	$import.on("click", ".btn-import", function () {
		const type = $(this).data("type");
		const state = import_state[type] || {};
		const file_url = state.file_url;
		if (!file_url) {
			frappe.msgprint("Upload a file first.");
			return;
		}
		const args = { file_url: file_url };
		if (level === "Department") {
			args.department = department;
		}
		if (level === "Individual") {
			args.employee = employee;
		}
		frappe.call({
			method: method_map[type].importer,
			args: args,
			callback: function (r) {
				if (r.message) {
					const summary = r.message;
					frappe.show_alert({
						message: `Import complete. Created: ${summary.created || 0}, Updated: ${summary.updated || 0}, Skipped: ${summary.skipped || 0}`,
						indicator: "green"
					});
					if (level === "Individual") {
						load_strategy_data($container, "Individual", department, employee);
					} else {
						load_strategy_data($container, level === "Department" ? "Department" : "Company", department);
					}
				}
			}
		});
	});
}

function get_import_method_map(level) {
	if (level === "Department") {
		return {
			goal: {
				preview: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.preview_department_goal_import",
				importer: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.import_department_goals",
				template: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.download_department_goal_template",
				exporter: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.export_department_goals"
			},
			kra: {
				preview: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.preview_department_kra_import",
				importer: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.import_department_kra",
				template: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.download_department_kra_template",
				exporter: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.export_department_kra"
			}
		};
	}
	if (level === "Individual") {
		return {
			goal: {
				preview: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.preview_employee_goal_import",
				importer: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.import_employee_goals",
				template: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.download_employee_goal_template",
				exporter: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.export_employee_goals"
			},
			kra: {
				preview: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.preview_employee_kra_import",
				importer: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.import_employee_kra",
				template: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.download_employee_kra_template",
				exporter: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.export_employee_kra"
			},
			kpi: {
				preview: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.preview_employee_kpi_import",
				importer: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.import_employee_kpi",
				template: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.download_employee_kpi_template",
				exporter: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.export_employee_kpi"
			}
		};
	}
	return {
		kpa: {
			preview: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.preview_company_kpa_import",
			importer: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.import_company_kpa",
			template: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.download_company_kpa_template",
			exporter: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.export_company_kpa"
		},
		goal: {
			preview: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.preview_company_goal_import",
			importer: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.import_company_goals",
			template: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.download_company_goal_template",
			exporter: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.export_company_goals"
		}
	};
}

function render_import_preview($container, preview) {
	const headers = preview.headers || [];
	const rows = preview.rows || [];
	const summary = preview.summary || {};

	if (!rows.length) {
		$container.html('<div class="text-muted small">No rows found in file.</div>');
		return;
	}

	let html = `
		<div class="import-summary text-muted small">
			Total: ${summary.total || 0} | Valid: ${summary.valid || 0} | Invalid: ${summary.invalid || 0}
		</div>
		<div class="table-responsive">
			<table class="table table-bordered table-sm import-table">
				<thead>
					<tr>
						${headers.map(h => `<th>${frappe.utils.escape_html(h)}</th>`).join("")}
					</tr>
				</thead>
				<tbody>
					${rows.map(row => `
						<tr class="${row.Status === "Invalid" ? "row-invalid" : "row-valid"}">
							${headers.map(h => `<td>${frappe.utils.escape_html(row[h] ?? "")}</td>`).join("")}
						</tr>
					`).join("")}
				</tbody>
			</table>
		</div>
	`;
	$container.html(html);
}

function render_company_strategy($container, company) {
	const kpas = company.kpas || [];
	if (!kpas.length) {
		$container.html('<div class="text-center text-muted">No company KPAs or goals found.</div>');
		return;
	}

	let html = `
		<div class="table-responsive">
			<table class="table table-bordered table-hover">
				<thead class="thead-light">
					<tr>
						<th style="width: 20%">KPA</th>
						<th style="width: 30%">Goal</th>
						<th style="width: 25%">Top Dept</th>
						<th style="width: 25%">Bottom Dept</th>
					</tr>
				</thead>
				<tbody>
	`;

	kpas.forEach(kpa => {
		(kpa.goals || []).forEach(goal => {
			const best = (goal.department_contributions || [])[0];
			const worst = goal.worst_department;
			const kpa_score = flt(kpa.average_score || 0);
			html += `
				<tr>
					<td class="editable-cell" data-goal-id="${goal.goal_id}" data-field="kpa" data-value="${kpa.kpa || ''}">
						<span class="cell-value">${kpa.kpa}</span>
						<div class="status-value">${kpa_score.toFixed(1)}%</div>
						${render_status_bar(kpa_score)}
					</td>
					<td class="editable-cell" data-goal-id="${goal.goal_id}" data-field="goal_name" data-value="${goal.goal || ''}">
						<span class="cell-value">${goal.goal}</span>
					</td>
					<td>
						${best ? `<span class="dept-link" data-dept="${best.department}">${best.department}</span>
						<span class="badge badge-green">${(best.average_score || 0).toFixed(1)}%</span>` : "-"}
					</td>
					<td>
						${worst ? `<span class="dept-link" data-dept="${worst.department}">${worst.department}</span>
						<span class="badge badge-red">${(worst.average_score || 0).toFixed(1)}%</span>` : "-"}
					</td>
				</tr>
			`;
		});
	});

	html += `</tbody></table></div>`;

	html += `<div class="dashboard-card">
		<div class="card-header blue">KPA & GOALS</div>
		<div class="card-content">
			<div class="table-responsive">
				<table class="table table-sm kpa-goals-table">
					<thead>
						<tr>
							<th style="width: 30%">KPA</th>
							<th>Goal</th>
							<th style="width: 20%">KPA Progress</th>
						</tr>
					</thead>
					<tbody>
						${kpas.map(kpa => `
							${(kpa.goals || []).length ? kpa.goals.map(g => `
								<tr>
									<td><strong>${kpa.kpa}</strong></td>
									<td>${g.goal}</td>
									<td>
										<div class="status-value">${(kpa.average_score || 0).toFixed(1)}%</div>
										${render_status_bar(kpa.average_score || 0)}
									</td>
								</tr>
							`).join("") : `
								<tr>
									<td><strong>${kpa.kpa}</strong></td>
									<td class="text-muted">No goals</td>
									<td>
										<div class="status-value">${(kpa.average_score || 0).toFixed(1)}%</div>
										${render_status_bar(kpa.average_score || 0)}
									</td>
								</tr>
							`}
						`).join("")}
					</tbody>
				</table>
			</div>
		</div>
	</div>`;


	$container.html(html);

	$container.find(".dept-link").on("click", function () {
		const dept = $(this).data("dept");
		if (!dept) {
			return;
		}
		const route = `/app/performance-scorecard?department=${encodeURIComponent(dept)}`;
		open_route_modal(
			"Department Scorecards",
			route,
			[["List", "Performance Scorecard"], ["Form", "Performance Scorecard"], ["performance-scorecard"]]
		);
	});
}

function open_route_modal(title, url, allowed_prefixes) {
	if (allowed_prefixes && allowed_prefixes.length) {
		return open_locked_modal(title, url, allowed_prefixes, {
			extra_css: `
				.page-head {
					position: sticky !important;
					top: 0;
					z-index: 10;
					background: #fff;
					margin: 0 !important;
					padding-top: 6px !important;
				}
				.page-head::before {
					content: "";
					position: absolute;
					inset: 0;
					background: #fff;
					z-index: -1;
				}
				.page-head .page-actions {
					margin-top: 0 !important;
				}
				.layout-main-section-wrapper,
				.layout-main-section,
				.page-body {
					padding-top: 0 !important;
				}
			`
		});
	}
	const dialog = new frappe.ui.Dialog({
		title: title,
		size: "extra-large",
		fields: [{ fieldname: "frame", fieldtype: "HTML" }]
	});
	dialog.get_field("frame").$wrapper.html(
		`<iframe src="${url}" style="width: 100%; height: 70vh; border: 0;"></iframe>`
	);
	dialog.show();
	return { dialog, frame: dialog.get_field("frame").$wrapper.find("iframe") };
}

function open_doctype_modal(doctype, name) {
	const slug = frappe.router.slug(doctype);
	const url = name ? `/app/${slug}/${encodeURIComponent(name)}` : `/app/${slug}/new-${slug}`;
	open_locked_modal(
		doctype,
		url,
		[["Form", doctype], ["List", doctype], [slug]],
		{
			extra_css: `
				.page-head {
					position: sticky !important;
					top: 0;
					z-index: 10;
					background: #fff;
					margin: 0 !important;
					padding-top: 6px !important;
				}
				.page-head::before {
					content: "";
					position: absolute;
					inset: 0;
					background: #fff;
					z-index: -1;
				}
				.page-head .page-actions {
					margin-top: 0 !important;
				}
				.layout-main-section-wrapper,
				.layout-main-section,
				.page-body {
					padding-top: 0 !important;
				}
			`
		}
	);
}

function open_report_modal(report_name, options) {
	const url = `/app/query-report/${encodeURIComponent(report_name)}`;
	let options_applied = false;

	const modal = open_locked_modal(report_name, url, [["query-report", report_name]]);
	const $frame = modal.frame;

	$frame.on("load", function () {
		if (!options || !Object.keys(options).length || options_applied) {
			return;
		}

		try {
			const win = this.contentWindow;
			if (win && win.frappe) {
				win.frappe.route_options = options;
				win.frappe.set_route("query-report", report_name);
				options_applied = true;
			}
		} catch (e) {
			// Ignore iframe access errors.
		}
	});
}

function open_locked_modal(title, url, allowed_prefixes, options) {
	const dialog = new frappe.ui.Dialog({
		title: title,
		size: "extra-large",
		fields: [{ fieldname: "frame", fieldtype: "HTML" }]
	});
	dialog.show();

	const $wrapper = dialog.get_field("frame").$wrapper;
	$wrapper.empty();

	const $frame = $('<iframe style="width: 100%; height: 70vh; border: 0;"></iframe>');
	$wrapper.append($frame);

	$frame.on("load", function () {
		apply_iframe_lock(this, allowed_prefixes || [], options);
	});

	$frame.attr("src", url);
	return { dialog, frame: $frame };
}

function apply_iframe_lock(frame, allowed_prefixes, options) {
	const prefixes = Array.isArray(allowed_prefixes) ? allowed_prefixes : [];
	const extra_css = options && options.extra_css ? options.extra_css : "";
	const max_attempts = 20;
	let attempts = 0;

	const ensure_lock = () => {
		attempts += 1;
		const win = frame.contentWindow;
		if (!win || !win.frappe || !win.frappe.set_route) {
			return attempts < max_attempts;
		}

		if (win.__psc_locked) {
			return false;
		}

		win.__psc_locked = true;
		inject_iframe_styles(win, extra_css);

		const original_set_route = win.frappe.set_route.bind(win.frappe);
		win.frappe.set_route = function () {
			const route = normalize_route(arguments);
			if (!is_route_allowed(route, prefixes)) {
				return;
			}
			return original_set_route.apply(win.frappe, arguments);
		};

		if (win.frappe.router && win.frappe.router.on) {
			win.frappe.router.on("change", () => {
				const route = win.frappe.get_route ? win.frappe.get_route() : [];
				if (!is_route_allowed(route, prefixes) && prefixes.length) {
					original_set_route.apply(win.frappe, prefixes[0]);
				}
			});
		}

		return false;
	};

	const interval = setInterval(() => {
		if (!ensure_lock()) {
			clearInterval(interval);
		}
	}, 300);
}

function normalize_route(args) {
	if (!args || !args.length) {
		return [];
	}
	if (Array.isArray(args[0])) {
		return args[0];
	}
	return Array.from(args);
}

function is_route_allowed(route, prefixes) {
	if (!prefixes || !prefixes.length) {
		return true;
	}
	if (!route || !route.length) {
		return true;
	}
	return prefixes.some(prefix => {
		if (!prefix || !prefix.length) {
			return false;
		}
		for (let i = 0; i < prefix.length; i += 1) {
			if (route[i] !== prefix[i]) {
				return false;
			}
		}
		return true;
	});
}

function inject_iframe_styles(win, extra_css) {
	try {
		const doc = win.document;
		if (!doc || doc.getElementById("psc-locked-style")) {
			return;
		}
		const style = doc.createElement("style");
		style.id = "psc-locked-style";
		style.textContent = `
			.navbar, .desk-sidebar, .layout-side-section, .app-sidebar {
				display: none !important;
			}
			.layout-main-section-wrapper {
				margin-left: 0 !important;
			}
			${extra_css || ""}
		`;
		doc.head.appendChild(style);
	} catch (e) {
		// Ignore cross-origin or DOM errors.
	}
}

function render_strategy_table($container, data, rollups, level) {
	if (!data.length) {
		$container.html('<div class="text-center text-muted">No goals found.</div>');
		return;
	}

	const is_department = level === "Department" && rollups && (rollups.kpas || []).length;
	const kpa_progress = new Map();
	const goal_progress = new Map();
	const kra_progress = new Map();

	if (is_department) {
		(rollups.kpas || []).forEach(kpa => {
			kpa_progress.set(kpa.kpa, flt(kpa.average_score || 0));
			(kpa.goals || []).forEach(goal => {
				if (goal.goal) {
					goal_progress.set(goal.goal, flt(goal.average_score || 0));
				}
				(goal.kras || []).forEach(kra => {
					if (kra.kra) {
						kra_progress.set(kra.kra, flt(kra.average_score || 0));
					}
				});
			});
		});
	}

	let html = `
		<div class="table-responsive">
			<table class="table table-bordered table-hover">
				<thead class="thead-light">
					<tr>
						<th style="width: 20%">KPA</th>
						<th style="width: 30%">Goal</th>
						<th style="width: 10%">Weight</th>
						<th style="width: 30%">Key Result Areas (KRAs)</th>
					</tr>
				</thead>
				<tbody>
	`;

	data.forEach(goal => {
		const kpa_key = goal.kpa_key || goal.kpa;
		const kpa_label = goal.kpa_label || goal.kpa;
		const kpa_value = is_department ? kpa_progress.get(kpa_key) : null;
		const goal_value = is_department
			? (goal_progress.get(goal.name) ?? flt(goal.progress || 0))
			: null;

		let kras_html = goal.kras.map(k => {
			const kra_value = is_department ? (kra_progress.get(k.name) ?? flt(k.progress || 0)) : null;
			return `
				<div class="kra-item" style="margin-bottom: 5px; padding-bottom: 5px; border-bottom: 1px dashed #eee;">
					<strong>${k.kra_name}</strong> <span class="badge badge-secondary">${k.weightage}%</span>
					${is_department && Number.isFinite(kra_value) ? `<div class="status-value">${kra_value.toFixed(1)}%</div>${render_status_bar(kra_value)}` : ""}
					<div class="text-muted small">${k.description || ''}</div>
				</div>
			`;
		}).join('');

		html += `
			<tr>
				<td>
					<div style="font-weight: bold;">${kpa_label || '-'}</div>
					${is_department && Number.isFinite(kpa_value) ? `<div class="status-value">${kpa_value.toFixed(1)}%</div>${render_status_bar(kpa_value)}` : ""}
				</td>
				<td>
					<div style="font-weight: bold;">${goal.goal_name}</div>
					<div class="small text-muted">${goal.start_date} - ${goal.end_date}</div>
					${is_department && Number.isFinite(goal_value) ? `<div class="status-value">${goal_value.toFixed(1)}%</div>${render_status_bar(goal_value)}` : ""}
				</td>
				<td>${goal.weightage}%</td>
				<td>${kras_html || '<span class="text-muted">No KRAs</span>'}</td>
			</tr>
		`;
	});

	html += `</tbody></table></div>`;
	$container.html(html);

}

function render_personal_panel($container, personal, rollups, goals) {
	$container.find(".personal-actions").remove();
	$container.find(".personal-summaries").remove();

	const today = frappe.datetime.get_today();
	const activeScorecard = (personal.scorecards || []).find(scorecard => {
		const start = scorecard.start_date || "";
		const end = scorecard.end_date || "";
		const start_ok = !start || start <= today;
		const end_ok = !end || end >= today;
		return start_ok && end_ok;
	});
	const add_scorecard_class = activeScorecard ? "btn btn-primary btn-sm disabled" : "btn btn-primary btn-sm";
	const add_scorecard_title = activeScorecard
		? "Update the existing scorecard for the current period."
		: "Add Scorecard";

	const kpa_rows = (rollups.kpas || []).map(k => {
		const avg = (k.average_score || 0).toFixed(1);
		const badge = avg >= 80 ? "badge-green" : (avg >= 60 ? "badge-yellow" : "badge-red");
		return `<div class="list-item"><span>${k.kpa}</span><span class="badge ${badge}">${avg}%</span></div>`;
	}).join("");

	const kra_rows = build_personal_kra_rows(goals);

	let html = `
		<div class="personal-actions">
			<button class="${add_scorecard_class}" data-action="new-scorecard" aria-disabled="${activeScorecard ? "true" : "false"}" title="${add_scorecard_title}">Add Scorecard</button>
			<button class="btn btn-primary btn-sm" data-action="new-goal">Add Goal</button>
			<button class="btn btn-default btn-sm" data-action="new-kra">Add KRA</button>
			<button class="btn btn-default btn-sm" data-action="new-kpi">Add KPI</button>
			<button class="btn btn-default btn-sm" data-action="new-weekly-commitment">Add Weekly Commitment</button>
		</div>
		<div class="personal-summaries">
			<div class="dashboard-card">
				<div class="card-header blue">MY SCORECARDS</div>
				<div class="card-content">
					${personal.scorecards.length ?
				personal.scorecards.map(s => `
						<div class="list-item scorecard-item" data-name="${s.name}">
							<span class="scorecard-link">${s.name}</span>
							<span class="badge badge-green">${s.status}</span>
						</div>
					`).join('') :
				'<div class="empty-state">No scorecards yet.</div>'}
				</div>
			</div>
			<div class="dashboard-card">
				<div class="card-header cyan">MY KRAS</div>
				<div class="card-content">
					${kra_rows}
				</div>
			</div>
			<div class="dashboard-card">
				<div class="card-header yellow">KPA AVERAGES</div>
				<div class="card-content">
					${kpa_rows || '<div class="empty-state">No KPA scores yet.</div>'}
				</div>
			</div>
		</div>
	`;

	$container.find(".strategy-content").before(html);

	$container.find(".personal-actions .btn").on("click", function () {
		const action = $(this).data("action");
		if (action === "new-scorecard") {
			if (activeScorecard) {
				const name = activeScorecard.name ? ` (${activeScorecard.name})` : "";
				frappe.msgprint(`You already have an active scorecard for the current period${name}. Please update it instead.`);
				return;
			}
			open_doctype_modal("Performance Scorecard");
		} else if (action === "new-goal") {
			open_doctype_modal("Goal Master");
		} else if (action === "new-kra") {
			open_doctype_modal("KRA Master");
		} else if (action === "new-kpi") {
			open_doctype_modal("KPI Master");
		} else if (action === "new-weekly-commitment") {
			open_doctype_modal("Weekly Commitment");
		}
	});

	$container.find(".scorecard-item").on("click", function () {
		const name = $(this).data("name");
		if (name) {
			open_doctype_modal("Performance Scorecard", name);
		}
	});
}

function build_personal_kra_rows(goals) {
	const kra_map = new Map();
	(goals || []).forEach(goal => {
		(goal.kras || []).forEach(kra => {
			if (!kra || !kra.name) {
				return;
			}
			if (!kra_map.has(kra.name)) {
				kra_map.set(kra.name, {
					name: kra.name,
					label: kra.kra_name || kra.name,
					progress: flt(kra.progress || 0)
				});
			}
		});
	});

	const kra_rows = Array.from(kra_map.values());
	if (!kra_rows.length) {
		return '<div class="empty-state">No KRAs yet.</div>';
	}

	return kra_rows.map(kra => {
		const avg = kra.progress.toFixed(1);
		const badge = kra.progress >= 80 ? "badge-green" : (kra.progress >= 60 ? "badge-yellow" : "badge-red");
		return `
			<div class="list-item">
				<span>${kra.label}</span>
				<span class="badge ${badge}">${avg}%</span>
			</div>
		`;
	}).join("");
}

function render_personal_tables($container, payload, $page_container) {
	const rows = payload.rows || [];
	const goals = payload.goals || [];
	const rollups = payload.rollups || {};

	const kpi_table = build_kpi_table(rows);
	const goal_table = build_goal_table(goals);
	const kpa_table = build_kpa_table(rollups.kpas || []);

	$container.html(`
		<div class="dashboard-card weekly-commitments-card">
			<div class="card-header blue">Weekly Commitments</div>
			<div class="card-content">
				<div class="weekly-commitments-list">
					<div class="empty-state">Loading commitments...</div>
				</div>
			</div>
		</div>
		<div class="dashboard-card">
			<div class="card-header blue">MY KPI LIST</div>
			<div class="card-content">${kpi_table}</div>
		</div>
		<div class="dashboard-card">
			<div class="card-header cyan">MY GOALS & KRAS</div>
			<div class="card-content">${goal_table}</div>
		</div>
		<div class="dashboard-card">
			<div class="card-header yellow">MY KPAS & GOALS</div>
			<div class="card-content">${kpa_table}</div>
		</div>
	`);

	$container.find(".btn-edit-row").on("click", function () {
		const row = rows[$(this).data("index")];
		if (!row || !row.item_name) {
			frappe.msgprint("Unable to edit this row. Please refresh and try again.");
			return;
		}

		const dialog = new frappe.ui.Dialog({
			title: "Edit Scorecard Item",
			fields: [
				{ fieldname: "kpa", fieldtype: "Link", options: "KPA Master", label: "KPA", reqd: 1, default: row.kpa },
				{ fieldname: "goal", fieldtype: "Link", options: "Goal Master", label: "Goal", reqd: 1, default: row.goal },
				{ fieldname: "kra", fieldtype: "Link", options: "KRA Master", label: "KRA", reqd: 1, default: row.kra },
				{ fieldname: "kpi", fieldtype: "Link", options: "KPI Master", label: "KPI", reqd: 1, default: row.kpi },
				{ fieldname: "weightage", fieldtype: "Percent", label: "Weightage", default: row.weightage },
				{ fieldname: "target", fieldtype: "Float", label: "Target", default: row.target },
				{ fieldname: "actual", fieldtype: "Float", label: "Actual", default: (row.base_actual ?? row.actual) }
			],
			primary_action_label: "Save",
			primary_action: (values) => {
				const baseActual = values.actual;
				const fields = {
					kpa: values.kpa,
					goal: values.goal,
					kra: values.kra,
					kpi: values.kpi,
					weightage: values.weightage,
					target: values.target
				};
				frappe.call({
					method: "frappe.client.set_value",
					args: {
						doctype: "Scorecard Item",
						name: row.item_name,
						fieldname: fields
					},
					callback: () => {
						frappe.call({
							method: "performance_scorecard.performance_scorecard.doctype.scorecard_item.scorecard_item.update_scorecard_item_actual",
							args: { item_name: row.item_name, base_actual: baseActual },
							callback: () => {
								dialog.hide();
								if ($page_container && $page_container.length) {
									const filters = $page_container.data("strategy-filters") || {};
									load_strategy_data($page_container, "Individual", filters.department, filters.employee);
								}
							}
						});
					}
				});
			}
		});
		dialog.show();
	});

}

function load_weekly_commitments($container, employee) {
	const $list = $container.find(".weekly-commitments-list");
	if (!$list.length) {
		return;
	}
	const $card = $container.find(".weekly-commitments-card");
	if (!employee) {
		$list.html('<div class="empty-state">No employee profile linked.</div>');
		return;
	}

	frappe.call({
		method: "frappe.client.get_list",
		args: {
			doctype: "Weekly Commitment",
			fields: ["name", "title", "description", "week_start", "week_end", "kpi", "kpi_unit", "actual_value", "status"],
			filters: { employee: employee },
			order_by: "week_start desc"
		},
		callback: function (r) {
			const items = r.message || [];
			if (!items.length) {
				fetch_by_owner();
				return;
			}
			$card.show();
			$list.html(render_weekly_commitments_table(items));
		}
	});

	function fetch_by_owner() {
		frappe.call({
			method: "frappe.client.get_list",
			args: {
			doctype: "Weekly Commitment",
			fields: ["name", "title", "description", "week_start", "week_end", "kpi", "kpi_unit", "actual_value", "status"],
			filters: { owner: frappe.session.user },
			order_by: "week_start desc"
		},
			callback: function (r) {
				const items = r.message || [];
				if (!items.length) {
					$card.hide();
					return;
				}
				$card.show();
				$list.html(render_weekly_commitments_table(items));
			}
		});
	}

	$list.off("change", "input, select, textarea").on("change", "input, select, textarea", function () {
		const $row = $(this).closest("tr");
		const name = $row.data("name");
		const field = $(this).data("field");
		const value = $(this).val();
		if (!name || !field) {
			return;
		}
		frappe.call({
			method: "performance_scorecard.performance_scorecard.doctype.weekly_commitment.weekly_commitment.update_commitment",
			args: { name: name, field: field, value: value },
			callback: function (r) {
				if (!r.message) {
					return;
				}
				const $unitBtn = $row.find(".weekly-unit-btn");
				if ($unitBtn.length) {
					$unitBtn.text(r.message.kpi_unit || "Unit");
					$unitBtn.data("kpi", r.message.kpi || "");
				}
				const $page = $container.closest(".dashboard-content-area");
				const filters = $page.data("strategy-filters") || {};
				if ($page.length) {
					load_strategy_data($page, "Individual", filters.department, filters.employee);
				}
			}
		});
	});

	$list.off("click", ".weekly-unit-btn").on("click", ".weekly-unit-btn", function (e) {
		e.preventDefault();
		const kpi = $(this).data("kpi");
		if (kpi) {
			open_doctype_modal("KPI Master", kpi);
		}
	});
}

function render_weekly_commitments_table(items) {
	if (!items || !items.length) {
		return '<div class="empty-state">No weekly commitments yet.</div>';
	}

	const rows = items.map(item => `
		<tr data-name="${item.name}">
			<td><input class="form-control input-xs" data-field="title" value="${frappe.utils.escape_html(item.title || "")}" /></td>
			<td><input class="form-control input-xs" data-field="kpi" value="${frappe.utils.escape_html(item.kpi || "")}" /></td>
			<td>
				<input class="form-control input-xs" data-field="actual_value" type="number" step="0.01" value="${item.actual_value ?? ""}" />
			</td>
			<td>
				<button class="btn btn-xs btn-default weekly-unit-btn" type="button" data-kpi="${frappe.utils.escape_html(item.kpi || "")}">
					${item.kpi_unit || "Unit"}
				</button>
			</td>
		</tr>
	`).join("");

	return `
		<div class="table-responsive">
			<table class="table table-bordered table-hover">
				<thead class="thead-light">
					<tr>
						<th style="width: 40%">Commitment</th>
						<th style="width: 30%">KPI</th>
						<th style="width: 15%">Actual</th>
						<th style="width: 15%">Unit</th>
					</tr>
				</thead>
				<tbody>
					${rows}
				</tbody>
			</table>
		</div>
	`;
}

function render_weekly_commitment_options(current) {
	const options = ["0%", "25%", "50%", "75%", "100%"];
	return options.map(value => {
		const selected = value === (current || "0%") ? "selected" : "";
		return `<option value="${value}" ${selected}>${value}</option>`;
	}).join("");
}

function build_kpi_table(rows) {
	if (!rows.length) {
		return '<div class="empty-state">No KPIs yet. Create a scorecard to populate this table.</div>';
	}

	let html = `
		<div class="table-responsive">
			<table class="table table-bordered table-hover">
				<thead class="thead-light">
					<tr>
						<th style="width: 20%">KPI</th>
						<th style="width: 18%">Target</th>
						<th style="width: 18%">Actual</th>
						<th style="width: 26%">Score</th>
						<th style="width: 10%">Rating</th>
						<th style="width: 8%">Actions</th>
					</tr>
				</thead>
				<tbody>
	`;

	rows.forEach((row, index) => {
		const score = flt(row.score || 0);
		html += `
			<tr>
				<td>${row.kpi_name || row.kpi || "-"}</td>
				<td>${row.target ?? "-"}</td>
				<td>${row.actual ?? "-"}</td>
				<td>
					<div class="status-value">${score.toFixed(1)}%</div>
					${render_status_bar(score)}
				</td>
				<td>${row.rating || "-"}</td>
				<td><button class="btn btn-xs btn-default btn-edit-row" data-index="${index}">Edit</button></td>
			</tr>
		`;
	});

	html += `</tbody></table></div>`;
	return html;
}

function build_goal_table(goals) {
	if (!goals.length) {
		return '<div class="empty-state">No goals found for your profile.</div>';
	}

	let html = `
		<div class="table-responsive">
			<table class="table table-bordered table-hover">
				<thead class="thead-light">
					<tr>
						<th style="width: 28%">Goal</th>
						<th style="width: 52%">KRAs</th>
						<th style="width: 20%">Progress</th>
					</tr>
				</thead>
				<tbody>
	`;

	goals.forEach(goal => {
		const kra_progress_values = (goal.kras || [])
			.map(kra => flt(kra.progress))
			.filter(value => !isNaN(value));
		const kra_progress_avg = kra_progress_values.length
			? (kra_progress_values.reduce((sum, value) => sum + value, 0) / kra_progress_values.length)
			: null;

		const kras = (goal.kras || []).map(kra => {
			const progress = flt(kra.progress || 0);
			return `
				<div class="kpi-item">
					<div class="kpi-title">${kra.kra_name}</div>
					<div class="status-value">${progress.toFixed(1)}%</div>
				</div>
			`;
		}).join("") || '<div class="empty-state">No KRAs linked.</div>';

		const goal_progress = kra_progress_avg !== null ? kra_progress_avg : 0;
		html += `
			<tr>
				<td>
					<div class="goal-name">${goal.goal_name || goal.name}</div>
					<div class="small text-muted">${goal.start_date || ""} ${goal.end_date ? `- ${goal.end_date}` : ""}</div>
				</td>
				<td>${kras}</td>
				<td>
					<div class="status-value">${goal_progress.toFixed(1)}%</div>
					${render_status_bar(goal_progress)}
				</td>
			</tr>
		`;
	});

	html += `</tbody></table></div>`;
	return html;
}

function build_kpa_table(kpas) {
	if (!kpas.length) {
		return '<div class="empty-state">No KPAs available yet.</div>';
	}

	let html = `
		<div class="table-responsive">
			<table class="table table-bordered table-hover">
				<thead class="thead-light">
					<tr>
						<th style="width: 26%">KPA</th>
						<th style="width: 50%">Goals</th>
						<th style="width: 24%">Progress</th>
					</tr>
				</thead>
				<tbody>
	`;

	kpas.forEach(kpa => {
		const goals = (kpa.goals || []).map(goal => {
			const progress = flt(goal.average_score || 0);
			return `
				<div class="kpi-item">
					<div class="kpi-title">${goal.goal || goal.goal_name || goal.goal_id || "-"}</div>
				</div>
			`;
		}).join("") || '<div class="empty-state">No goals linked.</div>';

		const kpa_progress = flt(kpa.average_score || 0);
		html += `
			<tr>
				<td>
					<div class="goal-name">${kpa.kpa}</div>
				</td>
				<td>${goals}</td>
				<td>
					<div class="status-value">${kpa_progress.toFixed(1)}%</div>
					${render_status_bar(kpa_progress)}
				</td>
			</tr>
		`;
	});

	html += `</tbody></table></div>`;
	return html;
}

function render_status_bar(percent) {
	const value = Math.max(0, Math.min(100, flt(percent || 0)));
	const color = value >= 80 ? "bg-success" : (value >= 60 ? "bg-warning" : "bg-danger");
	return `
		<div class="progress status-bar">
			<div class="progress-bar ${color}" role="progressbar" style="width: ${value}%" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100"></div>
		</div>
	`;
}

function render_strategy_maps($container) {
	const url = "/app/strategy-maps";
	$container.addClass("strategy-map-only");
	$container.html(`<iframe src="${url}" style="width: 100%; height: 80vh; border: 0;"></iframe>`);

	const frame = $container.find("iframe")[0];
	if (frame) {
		$(frame).on("load", function () {
			apply_iframe_lock(this, [["Page", "strategy-maps"], ["strategy-maps"]], {
				extra_css: `
					.page-head, .page-title, .page-actions, .layout-main-section-wrapper .page-head {
						display: none !important;
					}
					.layout-main-section-wrapper {
						padding-top: 0 !important;
					}
					html, body, .page-body, .layout-main-section-wrapper, .layout-main-section {
						background: #f5f7fb !important;
					}
					.page-body, .layout-main-section {
						padding: 0 !important;
					}
				`
			});
		});
	}
}

function render_documentation($container) {
	const sections = [
		{
			id: "quick-start",
			label: "Quick Start",
			color: "blue",
			content: `
				<ul>
					<li>Open Performance Dashboard from the sidebar and review the latest insights.</li>
					<li>Create or review goals under Strategy Plans (Company, Department, then Employee).</li>
					<li>Confirm KPIs and targets for your KRAs before creating a scorecard.</li>
					<li>Create a Performance Scorecard for the selected employee and period.</li>
					<li>Record Performance Updates weekly to keep actuals current.</li>
					<li>Use Weekly Commitments to track short-term delivery against KPIs.</li>
					<li>Review charts, scorecards, and risk dashboards regularly.</li>
				</ul>
			`
		},
		{
			id: "core-model",
			label: "Core Data Model",
			color: "light-blue",
			content: `
				<ul>
					<li>KPA Master: top-level performance area with weightage.</li>
					<li>Goal: strategic objective (Company, Department, or Employee).</li>
					<li>KRA: key result area tied to a Goal.</li>
					<li>KPI Master: measurable KPI tied to a KRA.</li>
					<li>Target: period targets for KPIs.</li>
					<li>Performance Scorecard: overall score and KPI items.</li>
					<li>Performance Update: actual KPI values for a period.</li>
					<li>Weekly Commitment: short-term commitments linked to KPIs.</li>
				</ul>
			`
		},
		{
			id: "calculations",
			label: "How Calculations Work",
			color: "cyan",
			content: `
				<div class="doc-subtitle">Item score</div>
				<pre class="doc-formula">score = (actual / target) * 100</pre>
				<div class="doc-subtitle">Weighted rollups</div>
				<pre class="doc-formula">weighted score = sum(score * weight) / sum(weight)</pre>
				<ul>
					<li>KPI scores roll up to KRA using KPI weightage.</li>
					<li>KRA scores roll up to Goal using KRA weightage.</li>
					<li>Goal scores roll up to KPA using Goal weightage.</li>
					<li>KPA scores roll up to the Scorecard overall score.</li>
				</ul>
				<div class="doc-note">Weights are percentages. If a weight is missing, that level contributes 0.</div>
			`
		},
		{
			id: "hierarchy",
			label: "Goal Hierarchy Rules",
			color: "red",
			content: `
				<ul>
					<li>Company Goals must link to a KPA and cannot have a parent.</li>
					<li>Department Goals must link to a parent Company Goal.</li>
					<li>Employee Goals must link to a parent Department Goal.</li>
					<li>KPA must match from parent to child goals.</li>
					<li>KRAs can only be created for Department or Employee goals.</li>
					<li>KPIs can only be created for Employee goals.</li>
				</ul>
			`
		},
		{
			id: "dashboard-home",
			label: "Performance Dashboard (Home)",
			color: "blue",
			content: `
				<ul>
					<li>My Key Objectives: goals assigned to you.</li>
					<li>My Key Results: KRAs tied to your goals.</li>
					<li>Needs Attention: low-scoring KPIs from the latest scorecard.</li>
					<li>My Tasks: pending performance updates.</li>
					<li>KPIs Needing Update: KPIs that require fresh data.</li>
					<li>Recent KPI Updates: your latest submitted values.</li>
				</ul>
			`
		},
		{
			id: "strategy-plans",
			label: "Strategy Plans",
			color: "light-blue",
			content: `
				<ul>
					<li>Company Strategy: high-level goals and KPAs.</li>
					<li>Department Strategy: goals that roll up to company goals.</li>
					<li>My Performance: employee goals, KRAs, and KPIs.</li>
					<li>Use Add Goal and Add KRA to build the hierarchy.</li>
					<li>Use the Department filter for Department Strategy.</li>
					<li>Use the Employee filter only when you have permission.</li>
				</ul>
			`
		},
		{
			id: "strategy-maps",
			label: "Strategy Maps",
			color: "cyan",
			content: `
				<ul>
					<li>Tree view of strategy by level.</li>
					<li>Click nodes to expand and explore relationships.</li>
					<li>Use maps to validate rollups and owner type paths.</li>
				</ul>
			`
		},
		{
			id: "risk-management",
			label: "Risk Management",
			color: "red",
			content: `
				<ul>
					<li>Risk Register: create, score, and track risks.</li>
					<li>Risk Context: define appetite and thresholds.</li>
					<li>Risk Treatment: record mitigations and residual risk.</li>
					<li>Risk Decision: approvals and sign-off for risks.</li>
					<li>Risk Heat Map: 5x5 grid of likelihood vs impact.</li>
				</ul>
			`
		},
		{
			id: "workflows",
			label: "Workflows: How To Update",
			color: "yellow",
			content: `
				<div class="doc-subtitle">Create Scorecard</div>
				<ul>
					<li>Open Performance Scorecard and click New.</li>
					<li>Select employee and period (start and end dates).</li>
					<li>Items auto-populate from KPIs linked to the employee.</li>
					<li>Set targets and weightages, then Save.</li>
					<li>Use Submit when ready for review.</li>
				</ul>
				<div class="doc-subtitle">Submit Updates</div>
				<ul>
					<li>Create a Performance Update for a KPI.</li>
					<li>Enter the actual value for the period and add comments.</li>
					<li>Save or Submit to update the scorecard.</li>
					<li>The scorecard recalculates automatically.</li>
				</ul>
				<div class="doc-subtitle">Weekly Commitments</div>
				<ul>
					<li>Add weekly commitments for KPIs you own.</li>
					<li>Update actual values as work completes.</li>
					<li>Commitments roll up into KPI actuals.</li>
				</ul>
			`
		},
		{
			id: "charts",
			label: "Charts and Indicators",
			color: "blue",
			content: `
				<ul>
					<li>Number Cards show counts for key scorecard states.</li>
					<li>Scorecards by Status: distribution across Draft, Submitted, Approved.</li>
					<li>Scorecards by Department: volume by department.</li>
					<li>Total Score by Department: average performance by department.</li>
					<li>Progress bars show percent completion for KPAs and goals.</li>
					<li>Green is strong, yellow is moderate, red is weak.</li>
				</ul>
			`
		},
		{
			id: "risk-calculations",
			label: "Risk Calculations",
			color: "light-blue",
			content: `
				<pre class="doc-formula">risk score = likelihood * impact</pre>
				<ul>
					<li>Likelihood and Impact are selected as numbered values.</li>
					<li>Risk Level: High (>=15), Medium (>=6), Low (below 6).</li>
					<li>Residual risk uses treatment rows to update the final score.</li>
					<li>Appetite breach is calculated from Performance Settings and Context.</li>
				</ul>
			`
		},
		{
			id: "admin",
			label: "Administration and Settings",
			color: "red",
			content: `
				<ul>
					<li>Scorecard Settings: rating scale and update frequency.</li>
					<li>Performance Settings: calculation method and risk appetite.</li>
					<li>Ensure roles have access to Goals, KRAs, KPIs, and Scorecards.</li>
					<li>Use Workspaces and Shortcuts for faster navigation.</li>
				</ul>
			`
		}
	];

	const cards = sections.map(section => `
		<div class="dashboard-card doc-card is-collapsed" data-doc="${section.id}">
			<button class="doc-toggle" type="button">
				<span class="doc-title">${section.label}</span>
				<span class="doc-toggle-meta">
					<span class="doc-toggle-icon">+</span>
					<span class="doc-toggle-text">Show details</span>
				</span>
			</button>
			<div class="card-content">${section.content}</div>
		</div>
	`).join("");

	$container.removeClass("strategy-map-only");
	$container.html(`
		<div class="doc-page">
			<div class="doc-hero">
				<h2>Performance Center User Guide</h2>
				<p>Use this page to understand how the app works, how calculations are done, and how to complete your daily work in Strategy, Scorecards, and Risk Management.</p>
			</div>
			<div class="doc-grid">
				${cards}
			</div>
		</div>
	`);

	$container.off("click", ".doc-toggle").on("click", ".doc-toggle", function () {
		const $card = $(this).closest(".doc-card");
		const was_collapsed = $card.hasClass("is-collapsed");
		$container.find(".doc-card").addClass("is-collapsed");
		$container.find(".doc-toggle-icon").text("+");
		$container.find(".doc-toggle-text").text("Show details");
		if (was_collapsed) {
			$card.removeClass("is-collapsed");
			$card.find(".doc-toggle-icon").text("-");
			$card.find(".doc-toggle-text").text("Hide details");
		}
	});
}

function render_reports($container) {
	const state = {
		reports: [],
		search: "",
		filters: {
			start_date: "",
			end_date: "",
			department: "",
			employee: ""
		}
	};

	$container.html(`
		<div class="reports-shell">
			<div class="reports-hero">
				<div>
					<div class="reports-kicker">Performance</div>
					<div class="reports-title">Performance Reports</div>
					<div class="reports-subtitle">Track scorecards, KPIs, and operational insight at a glance.</div>
				</div>
				<div class="reports-actions">
					<div class="reports-search">
						<i class="fa fa-search"></i>
						<input type="text" class="reports-search-input" placeholder="Search reports..." />
					</div>
					<button class="btn btn-primary btn-sm reports-refresh"><i class="fa fa-refresh"></i> Refresh</button>
				</div>
			</div>

			<div class="reports-filters">
				<div class="reports-filters-grid">
					<div class="reports-filter" data-filter="start-date">
						<label>Period Start</label>
						<div class="reports-control" data-control="start-date"></div>
					</div>
					<div class="reports-filter" data-filter="end-date">
						<label>Period End</label>
						<div class="reports-control" data-control="end-date"></div>
					</div>
					<div class="reports-filter" data-filter="department">
						<label>Department</label>
						<div class="reports-control" data-control="department"></div>
					</div>
					<div class="reports-filter" data-filter="employee">
						<label>Employee</label>
						<div class="reports-control" data-control="employee"></div>
					</div>
				</div>
			</div>

			<div class="reports-section">
				<div class="section-header">
					<div class="section-title">All Reports</div>
					<div class="section-subtitle">Browse the full report catalog</div>
				</div>
				<div class="reports-list"></div>
			</div>
		</div>
	`);

	const $shell = $container.find(".reports-shell");
	const $search = $shell.find(".reports-search-input");
	const $list = $shell.find(".reports-list");
	const $refresh = $shell.find(".reports-refresh");

	const controls = {
		start_date: frappe.ui.form.make_control({
			df: { fieldname: "start_date", fieldtype: "Date", placeholder: "Start date" },
			parent: $shell.find("[data-control='start-date']"),
			render_input: true
		}),
		end_date: frappe.ui.form.make_control({
			df: { fieldname: "end_date", fieldtype: "Date", placeholder: "End date" },
			parent: $shell.find("[data-control='end-date']"),
			render_input: true
		}),
		department: frappe.ui.form.make_control({
			df: { fieldname: "department", fieldtype: "Link", options: "Department", placeholder: "Department" },
			parent: $shell.find("[data-control='department']"),
			render_input: true
		}),
		employee: frappe.ui.form.make_control({
			df: {
				fieldname: "employee",
				fieldtype: "Link",
				options: "Employee",
				placeholder: "Employee",
				get_query: () => {
					const dept = controls.department.get_value();
					if (!dept) {
						return {};
					}
					return { filters: { department: dept } };
				}
			},
			parent: $shell.find("[data-control='employee']"),
			render_input: true
		})
	};

	Object.values(controls).forEach(control => control.refresh());

	function update_filters() {
		state.filters.start_date = controls.start_date.get_value();
		state.filters.end_date = controls.end_date.get_value();
		state.filters.department = controls.department.get_value();
		state.filters.employee = controls.employee.get_value();
	}

	function build_route_options() {
		update_filters();
		const options = {};
		if (state.filters.start_date) options.period_start = state.filters.start_date;
		if (state.filters.end_date) options.period_end = state.filters.end_date;
		if (state.filters.department) options.department = state.filters.department;
		if (state.filters.employee) options.employee = state.filters.employee;
		return options;
	}

	function open_report(report_name) {
		open_report_modal(report_name, build_route_options());
	}

	function matches_search(report) {
		if (!state.search) return true;
		const label = (report.report_name || report.name || "").toLowerCase();
		return label.includes(state.search.toLowerCase());
	}

	function render_list_row(report) {
		const name = report.report_name || report.name;
		return `
			<div class="report-list-row" data-report="${name}">
				<div>
					<div class="report-row-title">${name}</div>
					<div class="report-row-meta">${report.report_type || "Report"} | ${report.ref_doctype || "Performance Scorecard"}</div>
				</div>
				<div class="report-list-actions">
					<button class="btn btn-sm btn-default report-open" data-report="${name}">Open</button>
				</div>
			</div>
		`;
	}

	function render_reports_list() {
		update_filters();
		const reports = state.reports.filter(matches_search);
		$list.html(reports.length
			? reports.map(render_list_row).join("")
			: '<div class="empty-state">No reports match your filters.</div>');
	}

	function fetch_reports() {
		$list.html("");

		frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "Report",
				fields: ["name", "report_name", "report_type", "ref_doctype", "module"],
				filters: {
					module: "Performance Scorecard",
					disabled: 0
				},
				order_by: "report_name asc"
			},
			callback: function (r) {
				state.reports = r.message || [];
				render_reports_list();
			}
		});
	}

	$search.on("input", function () {
		state.search = $(this).val() || "";
		render_reports_list();
	});

	$refresh.on("click", function () {
		fetch_reports();
	});

	$shell.on("click", ".report-card, .report-list-row", function (e) {
		if ($(e.target).closest(".report-open").length) {
			return;
		}
		const report = $(this).data("report");
		if (report) {
			open_report(report);
		}
	});

	$shell.on("click", ".report-open", function (e) {
		e.preventDefault();
		e.stopPropagation();
		const report = $(this).data("report");
		if (report) {
			open_report(report);
		}
	});

	controls.start_date.$input.on("change", render_reports_list);
	controls.end_date.$input.on("change", render_reports_list);
	controls.department.$input.on("change", function () {
		controls.employee.set_value("");
		render_reports_list();
	});
	controls.employee.$input.on("change", function () {
		const employee = controls.employee.get_value();
		if (employee) {
			frappe.call({
				method: "frappe.client.get_value",
				args: {
					doctype: "Employee",
					filters: { name: employee },
					fieldname: "department"
				},
				callback: function (r) {
					const dept = r.message ? r.message.department : "";
					if (dept) {
						controls.department.set_value(dept);
					}
				}
			});
		}
		render_reports_list();
	});

	fetch_reports();
}

function render_dashboards($container) {
	$container.html(`
		<div class="dashboards-shell">
			<div class="dashboards-hero">
				<div class="dashboards-hero-left">
					<div class="dashboards-hero-title">Performance Center</div>
					<div class="dashboards-hero-subtitle">
						Live performance snapshot
						<span class="dashboards-updated" data-updated>Updated --</span>
					</div>
				</div>
				<div class="dashboards-hero-actions">
					<button class="btn btn-default btn-sm dashboards-action" data-action="refresh">
						<i class="fa fa-refresh"></i> Refresh
					</button>
					<button class="btn btn-default btn-sm dashboards-action" data-action="export">
						<i class="fa fa-download"></i> Export
					</button>
					<button class="btn btn-default btn-sm dashboards-action" data-action="print">
						<i class="fa fa-print"></i> Print
					</button>
					<button class="btn btn-default btn-sm dashboards-live" data-action="live">
						<span class="live-dot"></span> Live
					</button>
				</div>
			</div>
			<div class="dashboards-tabs">
				<button class="dashboards-tab is-active" data-tab="company">Company</button>
				<button class="dashboards-tab" data-tab="department">Department</button>
				<button class="dashboards-tab" data-tab="employee">Employee</button>
			</div>
			<div class="dashboards-filters">
				<span class="dashboards-filter">
					<span class="filter-control" data-control="department"></span>
				</span>
				<span class="dashboards-filter">
					<span class="filter-control" data-control="employee"></span>
				</span>
				<button class="btn btn-default btn-sm dashboards-refresh" title="Reload Filters">
					<i class="fa fa-refresh"></i>
				</button>
			</div>
			<div class="dashboards-content">
				<div class="dashboards-panel is-active" data-panel="company">
					<div class="empty-state">Loading company dashboard...</div>
				</div>
				<div class="dashboards-panel" data-panel="department">
					<div class="empty-state">Loading department dashboard...</div>
				</div>
				<div class="dashboards-panel" data-panel="employee">
					<div class="empty-state">Loading employee dashboard...</div>
				</div>
			</div>
		</div>
	`);

	const $tabs = $container.find(".dashboards-tab");
	const $panels = $container.find(".dashboards-panel");
	const $filters = $container.find(".dashboards-filters");
	const $refresh = $container.find(".dashboards-refresh");
	const $updated = $container.find("[data-updated]");
	const $live = $container.find(".dashboards-live");

	const dashboards_state = {
		live: false,
		timer: null,
		payload: null
	};

	const controls = {
		department: frappe.ui.form.make_control({
			df: { fieldname: "department", fieldtype: "Link", options: "Department", label: "", placeholder: "Department" },
			parent: $filters.find("[data-control='department']"),
			render_input: true
		}),
		employee: frappe.ui.form.make_control({
			df: {
				fieldname: "employee",
				fieldtype: "Link",
				options: "Employee",
				label: "",
				placeholder: "Employee ID",
				get_query: () => {
					const dept = controls.department.get_value();
					if (!dept) {
						return {};
					}
					return { filters: { department: dept } };
				}
			},
			parent: $filters.find("[data-control='employee']"),
			render_input: true
		})
	};

	Object.values(controls).forEach(control => control.refresh());

	$tabs.on("click", function () {
		const target = $(this).data("tab");
		$tabs.removeClass("is-active");
		$(this).addClass("is-active");
		$panels.removeClass("is-active");
		$panels.filter(`[data-panel="${target}"]`).addClass("is-active");
		if (target === "company") {
			$filters.hide();
		} else if (target === "department") {
			$filters.show();
			$filters.find("[data-control='employee']").closest(".dashboards-filter").hide();
			controls.employee.set_value("");
		} else {
			$filters.show();
			$filters.find("[data-control='employee']").closest(".dashboards-filter").show();
		}
	});

	function fetch_dashboards() {
		const department = controls.department.get_value();
		const employee = controls.employee.get_value();

		frappe.call({
			method: "performance_scorecard.performance_scorecard.page.performance_dashboard.performance_dashboard.get_dashboard_insights",
			args: { department: department, employee: employee },
			callback: function (r) {
				const insights = r.message || {};
				dashboards_state.payload = insights;
				$updated.text(`Updated ${frappe.datetime.now_time()}`);
				const resolved_department = department || (insights.meta || {}).department || "";
				const resolved_employee = employee || (insights.meta || {}).employee || "";
				if (!department && resolved_department) {
					controls.department.set_value(resolved_department);
				}
				if (!employee && resolved_employee) {
					controls.employee.set_value(resolved_employee);
				}
				render_company_dashboard($container, insights.company || {}, null);
				render_department_dashboard($container, insights.department || {}, insights.meta || {}, null);
				render_employee_dashboard($container, insights.employee || {}, insights.meta || {}, null);

				frappe.call({
					method: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.get_strategy_data",
					args: { level: "Company" },
					callback: function (res) {
						render_company_dashboard($container, insights.company || {}, res.message || {});
					}
				});

				frappe.call({
					method: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.get_strategy_data",
					args: { level: "Department", department: resolved_department || null },
					callback: function (res) {
						render_department_dashboard($container, insights.department || {}, insights.meta || {}, res.message || {});
					}
				});

				frappe.call({
					method: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.get_strategy_data",
					args: { level: "Individual", department: resolved_department, employee: resolved_employee },
					callback: function (res) {
						render_employee_dashboard($container, insights.employee || {}, insights.meta || {}, res.message || {});
					}
				});
			}
		});
	}

	$refresh.on("click", function () {
		fetch_dashboards();
	});

	$container.on("click", ".dashboards-action", function () {
		const action = $(this).data("action");
		if (action === "refresh") {
			fetch_dashboards();
			return;
		}
		if (action === "export") {
			if (!dashboards_state.payload) {
				frappe.msgprint("No dashboard data to export yet.");
				return;
			}
			download_dashboard_payload(dashboards_state.payload);
			return;
		}
		if (action === "print") {
			window.print();
		}
	});

	$live.on("click", function () {
		dashboards_state.live = !dashboards_state.live;
		$(this).toggleClass("is-live", dashboards_state.live);
		if (dashboards_state.timer) {
			clearInterval(dashboards_state.timer);
			dashboards_state.timer = null;
		}
		if (dashboards_state.live) {
			fetch_dashboards();
			dashboards_state.timer = setInterval(fetch_dashboards, 60000);
		}
	});

	controls.department.$input.on("change", function () {
		const tab = $tabs.filter(".is-active").data("tab");
		if (tab === "department" || tab === "employee") {
			controls.employee.set_value("");
			fetch_dashboards();
		}
	});

	controls.employee.$input.on("change", function () {
		const tab = $tabs.filter(".is-active").data("tab");
		if (tab === "employee") {
			fetch_dashboards();
		}
	});

	$container.on("click", ".metric-card[data-route]", function () {
		const route = $(this).data("route");
		const department = $(this).data("department");
		if (!route) {
			return;
		}
		const filters = {};
		if (department) {
			filters.department = department;
		}
		frappe.set_route("List", route, filters);
	});

	$filters.hide();
	fetch_dashboards();
}

function render_company_dashboard($container, data, strategy) {
	const panel = $container.find('[data-panel="company"]');
	if (!strategy || !strategy.meta) {
		panel.html('<div class="empty-state">Loading company dashboard...</div>');
		return;
	}

	const company_rollups = strategy.company || {};
	const company_goals = build_company_goal_items(company_rollups);
	const avg_score = average_score(data.kpa_scores);
	const dept_top = (data.department_comparison || [])[0];
	const dept_bottom = (data.department_comparison || [])[data.department_comparison.length - 1];

	const html = `
		<div class="dashboards-grid dashboards-grid-4">
			<div class="dashboard-card metric-card metric-ring-card" data-route="Performance Scorecard" title="Open scorecards">
				<div class="metric-ring" style="--value:${Math.min(Math.max(avg_score, 0), 100)}"></div>
				<div class="metric-body">
				<div class="metric-label">Overall Company Score</div>
				<div class="metric-value">${format_score(avg_score)}</div>
				<div class="metric-sub">Company health ${render_indicator_chip(avg_score)}</div>
				</div>
			</div>
			<div class="dashboard-card metric-card" data-route="Performance Scorecard" data-department="${dept_top ? dept_top.label : ""}" title="View best department scorecards">
				<div class="metric-label">Best Department</div>
				<div class="metric-value">${dept_top ? dept_top.label : "N/A"}</div>
				<div class="metric-sub">${dept_top ? `${format_score(dept_top.value)}% ${render_indicator_chip(dept_top.value)}` : "--"}</div>
			</div>
			<div class="dashboard-card metric-card" data-route="Performance Scorecard" data-department="${dept_bottom ? dept_bottom.label : ""}" title="View bottom department scorecards">
				<div class="metric-label">Bottom Department</div>
				<div class="metric-value">${dept_bottom ? dept_bottom.label : "N/A"}</div>
				<div class="metric-sub">${dept_bottom ? `${format_score(dept_bottom.value)}% ${render_indicator_chip(dept_bottom.value)}` : "--"}</div>
			</div>
			<div class="dashboard-card metric-card">
				<div class="metric-label">Departments Tracked</div>
				<div class="metric-value">${(data.department_comparison || [])[0]?.label || "N/A"}</div>
				<div class="metric-sub">${data.department_comparison && data.department_comparison.length > 1 ? `${data.department_comparison.length} departments` : "Active department"}</div>
			</div>
		</div>

		<div class="dashboards-grid dashboards-grid-2">
			<div class="dashboard-card">
				<div class="card-header blue">KPA Scores</div>
				<div class="chart-shell" id="company-kpa-chart"></div>
			</div>
			<div class="dashboard-card">
				<div class="card-header light-blue">Department Comparison</div>
				<div class="chart-shell" id="company-dept-chart"></div>
			</div>
		</div>

		<div class="dashboards-grid dashboards-grid-2">
			<div class="dashboard-card">
				<div class="card-header yellow">Company Goals Performance</div>
				<div class="chart-shell" id="company-goal-chart"></div>
			</div>
			<div class="dashboard-card">
				<div class="card-header cyan">Top 5 Employees</div>
				<div class="list-stack">
					${render_list((data.top_performers || []).slice(0, 5), "Top 5")}
				</div>
			</div>
		</div>

		<div class="dashboards-grid dashboards-grid-2">
			<div class="dashboard-card">
				<div class="card-header yellow">Trend Analysis</div>
				<div class="chart-shell" id="company-trend-chart"></div>
			</div>
		</div>
	`;

	panel.html(html);
	render_chart("#company-kpa-chart", data.kpa_scores, "bar");
	render_chart("#company-dept-chart", data.department_comparison, "bar");
	render_chart("#company-goal-chart", company_goals, "bar");
	render_chart("#company-trend-chart", data.trend, "line");
}

function render_department_dashboard($container, data, meta, strategy) {
	const panel = $container.find('[data-panel="department"]');
	if (!meta.department) {
		panel.html('<div class="empty-state">No department assigned to your user.</div>');
		return;
	}
	if (!strategy || !strategy.meta) {
		panel.html('<div class="empty-state">Loading department dashboard...</div>');
		return;
	}

	const rollups = strategy.rollups || {};
	const goals = strategy.goals || [];
	const kpa_items = (rollups.kpas || []).map(kpa => ({
		label: kpa.kpa,
		value: flt(kpa.average_score || 0)
	}));
	const rollup_goal_items = build_goal_items_from_rollups(rollups);
	const rollup_kra_items = build_kra_items_from_rollups(rollups);
	const goal_items = rollup_goal_items.length ? rollup_goal_items : build_goal_chart_items(goals);
	const kra_items = rollup_kra_items.length ? rollup_kra_items : build_kra_chart_items(goals);
	const goal_chart_items = rollup_goal_items.length ? build_goal_items_from_rollups(rollups, 6) : build_goal_chart_items(goals);
	const kra_chart_items = rollup_kra_items.length ? build_kra_items_from_rollups(rollups, 6) : build_kra_chart_items(goals);
	const top_goals = slice_ranked(goal_items, 5, "desc");
	const risk_goals = slice_ranked(goal_items, 5, "asc");
	const top_kras = slice_ranked(kra_items, 5, "desc");
	const risk_kras = slice_ranked(kra_items, 5, "asc");
	const overall_score = average_score(data.kpa_scores);

	const html = `
		<div class="dashboards-grid dashboards-grid-4">
			<div class="dashboard-card metric-card">
				<div class="metric-label">Overall Department Score</div>
				<div class="metric-value">${format_score(overall_score)}</div>
				${render_light(overall_score)}
			</div>
			<div class="dashboard-card metric-card">
				<div class="metric-label">Goal Achievement</div>
				<div class="metric-value">${format_score(data.goal_achievement_rate)}%</div>
				<div class="progress-line"><div class="progress-line-fill" style="width:${Math.min(data.goal_achievement_rate || 0, 100)}%"></div></div>
			</div>
			<div class="dashboard-card metric-card">
				<div class="metric-label">At-Risk Goals</div>
				<div class="metric-value">${risk_goals[0] ? risk_goals[0].label : "N/A"}</div>
				<div class="metric-sub">${risk_goals.length ? `${risk_goals.length} below target` : "Below target"}</div>
			</div>
			<div class="dashboard-card metric-card">
				<div class="metric-label">Top Performers</div>
				<div class="metric-value">${(data.top_employees || [])[0]?.label || "N/A"}</div>
				<div class="metric-sub">${data.top_employees && data.top_employees.length > 1 ? `${data.top_employees.length} leaders` : "Department leaders"}</div>
			</div>
		</div>

		<div class="dashboards-grid dashboards-grid-2">
			<div class="dashboard-card">
				<div class="card-header blue">KPA Performance Mix</div>
				<div class="chart-shell" id="dept-kpa-chart"></div>
			</div>
			<div class="dashboard-card">
				<div class="card-header light-blue">Goals Performance</div>
				<div class="chart-shell" id="dept-goal-chart"></div>
			</div>
		</div>

		<div class="dashboards-grid dashboards-grid-2">
			<div class="dashboard-card">
				<div class="card-header yellow">KRA Performance</div>
				<div class="chart-shell" id="dept-kra-chart"></div>
			</div>
			<div class="dashboard-card">
				<div class="card-header red">Goal Performance Trend</div>
				<div class="chart-shell" id="dept-trend-chart"></div>
			</div>
		</div>

		<div class="dashboards-grid dashboards-grid-2">
			<div class="dashboard-card">
				<div class="card-header blue">Best Goals</div>
				<div class="list-stack">
					${render_ranked_list(top_goals, "No goals scored yet.")}
				</div>
			</div>
			<div class="dashboard-card">
				<div class="card-header red">At-Risk Goals</div>
				<div class="list-stack">
					${render_ranked_list(risk_goals, "No goals at risk.")}
				</div>
			</div>
		</div>

		<div class="dashboards-grid dashboards-grid-2">
			<div class="dashboard-card">
				<div class="card-header blue">Best KRAs</div>
				<div class="list-stack">
					${render_ranked_list(top_kras, "No KRAs scored yet.")}
				</div>
			</div>
			<div class="dashboard-card">
				<div class="card-header red">At-Risk KRAs</div>
				<div class="list-stack">
					${render_ranked_list(risk_kras, "No KRAs at risk.")}
				</div>
			</div>
		</div>

		<div class="dashboards-grid dashboards-grid-2">
			<div class="dashboard-card">
				<div class="card-header cyan">Top 5 Employees</div>
				<div class="list-stack">
					${render_list((data.top_employees || []).slice(0, 5), "Top 5")}
				</div>
			</div>
		</div>
	`;

	panel.html(html);
	render_chart("#dept-kpa-chart", kpa_items.length ? kpa_items : data.kpa_scores, "pie");
	render_chart("#dept-goal-chart", goal_chart_items, "bar");
	render_chart("#dept-kra-chart", kra_chart_items, "bar");
	render_chart("#dept-trend-chart", data.trend, "line");
}

function render_employee_dashboard($container, data, meta, strategy) {
	const panel = $container.find('[data-panel="employee"]');
	if (!meta.employee) {
		panel.html('<div class="empty-state">No employee profile linked to your user.</div>');
		return;
	}
	if (!strategy || !strategy.meta) {
		panel.html('<div class="empty-state">Loading employee dashboard...</div>');
		return;
	}

	const scorecard = data.scorecard || {};
	const goal_progress = data.goal_progress || { items: [], average: 0 };
	const rollups = strategy.rollups || {};
	const goals = strategy.goals || [];
	const kpa_items = (rollups.kpas || []).map(kpa => ({
		label: kpa.kpa,
		value: flt(kpa.average_score || 0)
	}));
	const goal_items = build_goal_chart_items(goals);
	const overall_score = Number.isFinite(rollups.overall_score)
		? rollups.overall_score
		: (scorecard.overall_score || 0);
	const target_items = data.kpi_targets || [];

	const html = `
		<div class="dashboards-grid dashboards-grid-4">
			<div class="dashboard-card metric-card">
				<div class="metric-label">My Scorecard</div>
				<div class="metric-value">${format_score(overall_score)}</div>
				<div class="metric-sub">${scorecard.status || "No scorecard"}</div>
			</div>
			<div class="dashboard-card metric-card">
				<div class="metric-label">Goal Progress</div>
				<div class="metric-value">${format_score(goal_progress.average)}%</div>
				<div class="progress-line"><div class="progress-line-fill" style="width:${Math.min(goal_progress.average || 0, 100)}%"></div></div>
			</div>
			<div class="dashboard-card metric-card">
				<div class="metric-label">At-Risk KPIs</div>
				<div class="metric-value">${(data.at_risk_kpis || []).length}</div>
				<div class="metric-sub">Follow up</div>
			</div>
		</div>

		<div class="dashboards-grid dashboards-grid-2">
			<div class="dashboard-card">
				<div class="card-header blue">KPA Performance</div>
				<div class="chart-shell" id="employee-kpa-chart"></div>
			</div>
			<div class="dashboard-card">
				<div class="card-header light-blue">Goal Progress</div>
				<div class="chart-shell" id="employee-goal-chart"></div>
			</div>
		</div>

		<div class="dashboards-grid dashboards-grid-2">
			<div class="dashboard-card">
				<div class="card-header yellow">KPI Performance Trend</div>
				<div class="chart-shell" id="employee-trend-chart"></div>
			</div>
			<div class="dashboard-card">
				<div class="card-header red">At-Risk KPIs</div>
				<div class="list-stack">
					${render_at_risk(data.at_risk_kpis)}
				</div>
			</div>
		</div>

		<div class="dashboards-grid dashboards-grid-2">
			<div class="dashboard-card">
				<div class="card-header cyan">KPI Actual vs Target</div>
				<div class="chart-shell" id="employee-target-chart"></div>
			</div>
		</div>
	`;

	panel.html(html);
	render_chart("#employee-kpa-chart", kpa_items, "pie");
	render_chart("#employee-goal-chart", goal_items, "bar");
	render_chart("#employee-trend-chart", data.trend, "line");
	render_target_actual_chart("#employee-target-chart", target_items);
}

function build_goal_chart_items(goals) {
	const items = (goals || []).map(goal => {
		const kra_progress_values = (goal.kras || [])
			.map(kra => flt(kra.progress))
			.filter(value => !isNaN(value));
		const avg = kra_progress_values.length
			? (kra_progress_values.reduce((sum, value) => sum + value, 0) / kra_progress_values.length)
			: flt(goal.progress || 0);
		return { label: goal.goal_name || goal.name || "Goal", value: avg };
	});

	items.sort((a, b) => b.value - a.value);
	return items.slice(0, 6);
}

function build_kra_chart_items(goals) {
	const kra_map = new Map();
	(goals || []).forEach(goal => {
		(goal.kras || []).forEach(kra => {
			const label = kra.kra_name || kra.name || "KRA";
			if (!kra_map.has(label)) {
				kra_map.set(label, []);
			}
			kra_map.get(label).push(flt(kra.progress || 0));
		});
	});

	const items = Array.from(kra_map.entries()).map(([label, values]) => {
		const avg = values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
		return { label, value: avg };
	});

	items.sort((a, b) => b.value - a.value);
	return items.slice(0, 6);
}

function build_goal_items_from_rollups(rollups, limit) {
	const items = [];
	(rollups.kpas || []).forEach(kpa => {
		(kpa.goals || []).forEach(goal => {
			items.push({
				label: goal.goal || goal.goal_name || goal.goal_id || "Goal",
				value: flt(goal.average_score || 0)
			});
		});
	});

	items.sort((a, b) => b.value - a.value);
	if (limit) {
		return items.slice(0, limit);
	}
	return items;
}

function build_kra_items_from_rollups(rollups, limit) {
	const kra_map = new Map();
	(rollups.kpas || []).forEach(kpa => {
		(kpa.goals || []).forEach(goal => {
			(goal.kras || []).forEach(kra => {
				const label = kra.kra || kra.kra_name || "KRA";
				if (!kra_map.has(label)) {
					kra_map.set(label, []);
				}
				kra_map.get(label).push(flt(kra.average_score || 0));
			});
		});
	});

	const items = Array.from(kra_map.entries()).map(([label, values]) => {
		const avg = values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
		return { label, value: avg };
	});

	items.sort((a, b) => b.value - a.value);
	if (limit) {
		return items.slice(0, limit);
	}
	return items;
}

function build_company_goal_items(company_rollups) {
	const kpas = (company_rollups || {}).kpas || [];
	const goals = [];
	kpas.forEach(kpa => {
		(kpa.goals || []).forEach(goal => {
			goals.push({
				label: goal.goal || goal.goal_name || "Goal",
				value: flt(goal.average_score || 0)
			});
		});
	});

	goals.sort((a, b) => b.value - a.value);
	return goals.slice(0, 8);
}

function build_company_goal_list(company_rollups) {
	const kpas = (company_rollups || {}).kpas || [];
	const goals = [];
	kpas.forEach(kpa => {
		(kpa.goals || []).forEach(goal => {
			goals.push({
				goal: goal.goal || goal.goal_name || "Goal",
				kpa: kpa.kpa,
				value: flt(goal.average_score || 0)
			});
		});
	});

	goals.sort((a, b) => b.value - a.value);
	return goals;
}

function slice_ranked(items, count, order) {
	if (!items || !items.length) {
		return [];
	}
	const sorted = [...items].sort((a, b) => {
		return order === "asc" ? a.value - b.value : b.value - a.value;
	});
	return sorted.slice(0, count);
}

function render_ranked_list(items, empty_text) {
	if (!items || !items.length) {
		return `<div class="empty-state">${empty_text}</div>`;
	}

	return items.map(item => `
		<div class="list-row">
			<span>${item.label}</span>
			<span class="status-pill ${score_class(item.value)}">${format_score(item.value)}</span>
		</div>
	`).join("");
}

function render_chart(target, items, type, options) {
	const $target = $(target);
	if (!$target.length) {
		return;
	}

	$target.empty();
	$target.removeClass("psc-pie-chart");

	if (!items || !items.length) {
		$target.html('<div class="empty-state">No data available.</div>');
		return;
	}

	const cleaned = (items || []).map(item => {
		if (!item) {
			return null;
		}

		const label = item.label || "Unlabeled";
		let raw = item.value;
		if (typeof raw === "string") {
			raw = raw.replace(/,/g, "");
		}
		const value = Number(raw);
		if (!Number.isFinite(value)) {
			return null;
		}
		return { label: label, value: value };
	}).filter(Boolean);

	if (!cleaned.length) {
		$target.html('<div class="empty-state">No data available.</div>');
		return;
	}

	const labels = cleaned.map(item => item.label);
	const values = cleaned.map(item => item.value);

	const opts = options || {};
	const defaultPalette = ["#1AA6A4", "#F46B2A", "#0B2740", "#F4A261"];
	const palette = (opts.colors && opts.colors.length) ? opts.colors : defaultPalette;

	if (type === "pie") {
		const total = values.reduce((sum, val) => sum + val, 0);
		if (!Number.isFinite(total) || total <= 0) {
			$target.html('<div class="empty-state">No data available.</div>');
			return;
		}

		const pie_values = opts.normalize
			? values.map(value => (value / total) * 100)
			: values;

		$target.addClass("psc-pie-chart");
		const $wrap = $('<div class="psc-chart-flex"></div>');
		const $chart = $('<div class="psc-chart-canvas"></div>');
		const $legend = $('<div class="psc-chart-legend" aria-label="Chart legend"></div>');
		$wrap.append($chart, $legend);
		$target.append($wrap);

		new frappe.Chart($chart.get(0), {
			data: {
				labels: labels,
				datasets: [{ values: pie_values }]
			},
			type: "pie",
			height: 220,
			colors: palette
		});

		labels.forEach((label, index) => {
			const color = palette[index % palette.length];
			const value = pie_values[index];
			const value_label = opts.normalize ? `${format_score(value)}%` : format_score(value);
			const $row = $(`
				<div class="psc-legend-item">
					<span class="psc-legend-swatch" style="background:${color}"></span>
					<span class="psc-legend-label">${frappe.utils.escape_html(label)}</span>
					<span class="psc-legend-value">${value_label}</span>
				</div>
			`);
			$legend.append($row);
		});
		return;
	}

	new frappe.Chart(target, {
		data: {
			labels: labels,
			datasets: [{ values: values }]
		},
		type: type,
		height: 220,
		colors: palette
	});
}

function render_target_actual_chart(target, items) {
	const $target = $(target);
	if (!$target.length) {
		return;
	}

	$target.empty();

	if (!items || !items.length) {
		$target.html('<div class="empty-state">No target data available.</div>');
		return;
	}

	const sorted_items = [...items].sort((a, b) => {
		const a_target = Number(a.target || 0);
		const b_target = Number(b.target || 0);
		if (a_target !== b_target) {
			return a_target - b_target;
		}
		return Number(a.actual || 0) - Number(b.actual || 0);
	});

	const labels = sorted_items.map(item => item.label || "KPI");
	const targets = sorted_items.map(item => Number(item.target || 0));
	const actuals = sorted_items.map(item => Number(item.actual || 0));

	new frappe.Chart(target, {
		data: {
			labels: labels,
			datasets: [
				{ name: "Target", values: targets },
				{ name: "Actual", values: actuals }
			]
		},
		type: "line",
		height: 260,
		lineOptions: {
			spline: 1,
			regionFill: 0,
			dotSize: 4
		},
		axisOptions: {
			yAxisMin: 0
		},
		colors: ["#718096", "#2f5aa8"]
	});
}

function render_list(items, label) {
	if (!items || !items.length) {
		return `<div class="empty-state">${label} performers unavailable.</div>`;
	}

	const rows = items.map(item => `
		<div class="list-row">
			<span>${item.label}</span>
			<span>${format_score(item.value)}</span>
		</div>
	`).join("");

	return `
		<div class="list-block">
			<div class="list-title">${label}</div>
			${rows}
		</div>
	`;
}

function render_at_risk(items) {
	if (!items || !items.length) {
		return '<div class="empty-state">All KPIs are on track.</div>';
	}

	return items.map(item => `
		<div class="list-row">
			<span>${item.label}</span>
			<span class="status-pill ${score_class(item.value)}">${format_score(item.value)}</span>
		</div>
	`).join("");
}

function render_goal_progress(items) {
	if (!items || !items.length) {
		return '<div class="empty-state">No active goals assigned.</div>';
	}

	return items.map(goal => `
		<div class="progress-row">
			<div>${goal.goal_name}</div>
			<div class="progress-line"><div class="progress-line-fill" style="width:${Math.min(goal.progress || 0, 100)}%"></div></div>
		</div>
	`).join("");
}

function format_score(value) {
	if (value === null || value === undefined || value === "") {
		return "--";
	}
	return Number(value).toFixed(1);
}

function average_score(items) {
	if (!items || !items.length) {
		return 0;
	}
	const total = items.reduce((sum, item) => sum + (item.value || 0), 0);
	return total / items.length;
}

function score_class(value) {
	if (value >= 80) {
		return "is-green";
	}
	if (value >= 60) {
		return "is-yellow";
	}
	return "is-red";
}

function render_light(value) {
	const cls = score_class(value);
	return `<span class="status-light ${cls}"></span>`;
}

function render_indicator_chip(value) {
	if (value >= 80) {
		return '<span class="indicator-chip is-up"><i class="fa fa-arrow-up"></i> Strong</span>';
	}
	if (value >= 60) {
		return '<span class="indicator-chip is-flat"><i class="fa fa-minus"></i> Stable</span>';
	}
	return '<span class="indicator-chip is-down"><i class="fa fa-arrow-down"></i> Needs attention</span>';
}

function download_dashboard_payload(payload) {
	const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `performance-dashboard-${frappe.datetime.now_date()}.json`;
	link.click();
	URL.revokeObjectURL(url);
}
