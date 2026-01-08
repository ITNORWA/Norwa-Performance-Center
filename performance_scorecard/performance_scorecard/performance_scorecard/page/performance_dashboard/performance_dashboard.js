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
					<li data-section="administration"><i class="fa fa-cog"></i> Administration</li>
				</ul>
			<div class="user-profile">
				<div class="user-avatar"></div>
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
				<div class="card-header red">At-Risk Summary</div>
				<div class="card-content summary-split">
					<div>
						<div class="summary-subtitle">Company (${(data.attention_company || []).length})</div>
						${render_home_list(data.attention_company, "No company KRAs flagged.", { doctype: "KRA" })}
					</div>
					<div>
						<div class="summary-subtitle">Department (${(data.attention_department || []).length})</div>
						${render_home_list(data.attention_department, "No department KRAs flagged.", { doctype: "KRA" })}
					</div>
					<div>
						<div class="summary-subtitle">Individual (${(data.attention_individual || []).length})</div>
						${render_home_list(data.attention_individual, "No individual KRAs flagged.", { doctype: "KRA" })}
					</div>
				</div>
			</div>
			<div class="dashboard-card">
				<div class="card-header blue">Top Achievements</div>
				<div class="card-content summary-split">
					<div>
						<div class="summary-subtitle">Weekly</div>
						${render_home_list(data.weekly_top_kras, "No weekly achievements yet.", { doctype: "KRA" })}
					</div>
					<div>
						<div class="summary-subtitle">Quarterly</div>
						${render_home_list(data.quarterly_top_kras, "No quarterly achievements yet.", { doctype: "KRA" })}
					</div>
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
	render_chart("#home-kpa-company", progress.company, "pie", { colors: palette });
	render_chart("#home-kpa-department", progress.department, "pie", { colors: palette });
	render_chart("#home-kpa-individual", progress.individual, "pie", { colors: palette });
}

function render_home_list(items, empty_text, options) {
	if (!items || !items.length) {
		return `<div class="empty-state">${empty_text}</div>`;
	}

	const doctype = options && options.doctype;
	return items.map(item => `
		<div class="list-item ${doctype && item.name ? "home-link" : ""}" ${doctype && item.name ? `data-doctype="${doctype}" data-name="${item.name}"` : ""}>
			<span>${item.label}</span>
			<span class="badge badge-green">${format_score(item.value)}%</span>
		</div>
	`).join("");
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
			<span class="dept-filter"></span>
		</div>
		<div class="strategy-content"></div>
	`);

	const $actions = $container.find(".strategy-actions");
	const $deptFilter = $actions.find(".dept-filter");
	const deptControl = frappe.ui.form.make_control({
		df: { fieldname: "department", fieldtype: "Link", options: "Department", label: "Department" },
		parent: $deptFilter,
		render_input: true
	});
	deptControl.refresh();

	$container.find(".nav-link").on("click", function (e) {
		e.preventDefault();
		$container.find(".nav-link").removeClass("active");
		$(this).addClass("active");
		const level = $(this).data("level");
		update_strategy_actions($actions, level);
		load_strategy_data($container, level, deptControl.get_value());
	});

	update_strategy_actions($actions, "Company");
	load_strategy_data($container, "Company", null);

		$actions.find("[data-action='add-goal']").on("click", function () {
			open_doctype_modal("Goal");
		});
		$actions.find("[data-action='add-kra']").on("click", function () {
			open_doctype_modal("KRA");
		});
		$actions.find("[data-action='add-kpa']").on("click", function () {
			open_doctype_modal("KPA Master");
		});
	deptControl.$input.on("change", function () {
		const level = $container.find(".nav-link.active").data("level");
		if (level === "Department") {
			load_strategy_data($container, "Department", deptControl.get_value());
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

function load_strategy_data($container, level, department) {
	const $content = $container.find(".strategy-content");
	$content.html('<div class="text-center text-muted">Loading...</div>');

	frappe.call({
		method: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.get_strategy_data",
		args: { level: level, department: department },
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
		} else {
			$actions.find("[data-action='add-goal']").text("Add Department Goal").show();
			$actions.find("[data-action='add-kra']").show();
			$actions.find("[data-action='add-kpa']").hide();
		$actions.find(".dept-filter").hide();
		}
	} else {
		$actions.hide();
	}
}

function render_company_strategy($container, company) {
	const kpas = company.kpas || [];
	if (!kpas.length) {
		$container.html('<div class="text-center text-muted">No company KPAs or goals found.</div>');
		return;
	}

	const edit_icon = frappe.utils.icon("edit", "sm");
	let html = `
		<div class="table-responsive">
			<table class="table table-bordered table-hover">
				<thead class="thead-light">
					<tr>
						<th style="width: 16%">KPA</th>
						<th style="width: 22%">Goal</th>
						<th style="width: 10%">Goal Weight</th>
						<th style="width: 12%">Avg Dept Weight</th>
						<th style="width: 20%">Top Dept</th>
						<th style="width: 20%">Bottom Dept</th>
					</tr>
				</thead>
				<tbody>
	`;

	kpas.forEach(kpa => {
		(kpa.goals || []).forEach(goal => {
			const best = (goal.department_contributions || [])[0];
			const worst = goal.worst_department;
			html += `
				<tr>
					<td class="editable-cell" data-goal-id="${goal.goal_id}" data-field="kpa" data-value="${kpa.kpa || ''}">
						<span class="cell-value">${kpa.kpa}</span>
						<span class="edit-icon">${edit_icon}</span>
					</td>
					<td class="editable-cell" data-goal-id="${goal.goal_id}" data-field="goal_name" data-value="${goal.goal || ''}">
						<span class="cell-value">${goal.goal}</span>
						<span class="edit-icon">${edit_icon}</span>
					</td>
					<td>${goal.weightage || 0}%</td>
					<td>${(goal.avg_dept_weightage || 0).toFixed(1)}%</td>
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
							<th style="width: 16%">Contribution</th>
							<th style="width: 16%">KPA Progress</th>
						</tr>
					</thead>
					<tbody>
						${kpas.map(kpa => `
							${(kpa.goals || []).length ? kpa.goals.map(g => `
								<tr>
									<td><strong>${kpa.kpa}</strong></td>
									<td>${g.goal}</td>
									<td>${(g.weightage || 0).toFixed(1)}%</td>
									<td><span class="badge badge-green">${(kpa.average_score || 0).toFixed(1)}%</span></td>
								</tr>
							`).join("") : `
								<tr>
									<td><strong>${kpa.kpa}</strong></td>
									<td class="text-muted">No goals</td>
									<td>0%</td>
									<td><span class="badge badge-green">${(kpa.average_score || 0).toFixed(1)}%</span></td>
								</tr>
							`}
						`).join("")}
					</tbody>
				</table>
			</div>
		</div>
	</div>`;

	$container.html(html);

	$container.find(".editable-cell").on("click", function () {
		const $cell = $(this);
		if ($cell.hasClass("editing")) {
			return;
		}
		const goal_id = $cell.data("goal-id");
		const field = $cell.data("field");
		const current = $cell.data("value") || "";
		if (!goal_id || !field) {
			return;
		}

		$cell.addClass("editing");
		const $wrapper = $("<div class='inline-editor'></div>");
		$cell.find(".cell-value").hide();
		$cell.append($wrapper);

		const control = frappe.ui.form.make_control({
			df: {
				fieldtype: field === "kpa" ? "Link" : "Data",
				fieldname: field,
				options: field === "kpa" ? "KPA Master" : undefined
			},
			parent: $wrapper,
			render_input: true
		});
		control.set_value(current);
		control.refresh();
		control.$input.focus();

		const save_value = () => {
			const value = control.get_value();
			frappe.call({
				method: "frappe.client.set_value",
				args: {
					doctype: "Goal",
					name: goal_id,
					fieldname: field,
					value: value
				},
				callback: () => {
					$cell.removeClass("editing");
					$wrapper.remove();
					$cell.find(".cell-value").text(value || "-").show();
					$cell.data("value", value);
					const $page = $container.closest(".dashboard-content-area");
					load_strategy_data($page, "Company");
				}
			});
		};

		control.$input.on("blur", save_value);
		control.$input.on("keydown", function (e) {
			if (e.key === "Enter") {
				e.preventDefault();
				save_value();
			}
		});
	});

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

	const kpa_rows = (rollups.kpas || []).map(k => {
		const avg = (k.average_score || 0).toFixed(1);
		const badge = avg >= 80 ? "badge-green" : (avg >= 60 ? "badge-yellow" : "badge-red");
		return `<div class="list-item"><span>${k.kpa}</span><span class="badge ${badge}">${avg}%</span></div>`;
	}).join("");

	const kra_rows = build_personal_kra_rows(goals);

	let html = `
		<div class="personal-actions">
			<button class="btn btn-primary btn-sm" data-action="new-scorecard">Add Scorecard</button>
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
			open_doctype_modal("Performance Scorecard");
		} else if (action === "new-goal") {
			open_doctype_modal("Goal");
		} else if (action === "new-kra") {
			open_doctype_modal("KRA");
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
				{ fieldname: "goal", fieldtype: "Link", options: "Goal", label: "Goal", reqd: 1, default: row.goal },
				{ fieldname: "kra", fieldtype: "Link", options: "KRA", label: "KRA", reqd: 1, default: row.kra },
				{ fieldname: "kpi", fieldtype: "Link", options: "KPI Master", label: "KPI", reqd: 1, default: row.kpi },
				{ fieldname: "weightage", fieldtype: "Percent", label: "Weightage", default: row.weightage },
				{ fieldname: "target", fieldtype: "Float", label: "Target", default: row.target },
				{ fieldname: "actual", fieldtype: "Float", label: "Actual", default: row.actual }
			],
			primary_action_label: "Save",
			primary_action: (values) => {
				frappe.call({
					method: "frappe.client.set_value",
					args: {
						doctype: "Scorecard Item",
						name: row.item_name,
						fieldname: values
					},
					callback: () => {
						dialog.hide();
						if ($page_container && $page_container.length) {
							load_strategy_data($page_container, "Individual");
						}
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
			fields: ["name", "title", "description", "week_start", "week_end", "kpi", "status"],
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
				fields: ["name", "title", "description", "week_start", "week_end", "kpi", "status"],
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
			method: "frappe.client.set_value",
			args: {
				doctype: "Weekly Commitment",
				name: name,
				fieldname: field,
				value: value
			}
		});
	});
}

function render_weekly_commitments_table(items) {
	if (!items || !items.length) {
		return '<div class="empty-state">No weekly commitments yet.</div>';
	}

	const rows = items.map(item => `
		<tr data-name="${item.name}">
			<td><input class="form-control input-xs" data-field="title" value="${frappe.utils.escape_html(item.title || "")}" /></td>
			<td><input class="form-control input-xs" data-field="week_start" type="date" value="${item.week_start || ""}" /></td>
			<td><input class="form-control input-xs" data-field="week_end" type="date" value="${item.week_end || ""}" /></td>
			<td><input class="form-control input-xs" data-field="kpi" value="${frappe.utils.escape_html(item.kpi || "")}" /></td>
			<td>
				<select class="form-control input-xs" data-field="status">
					${render_weekly_commitment_options(item.status)}
				</select>
			</td>
		</tr>
	`).join("");

	return `
		<div class="table-responsive">
			<table class="table table-bordered table-hover">
				<thead class="thead-light">
					<tr>
						<th style="width: 40%">Title</th>
						<th style="width: 20%">Week Start</th>
						<th style="width: 18%">Week End</th>
						<th style="width: 22%">KPI</th>
						<th style="width: 20%">Progress</th>
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

function render_reports($container) {
	const state = {
		scope: "All",
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

			<div class="reports-tabs">
				<button class="reports-tab is-active" data-scope="All">All</button>
				<button class="reports-tab" data-scope="Company">Company</button>
				<button class="reports-tab" data-scope="Department">Department</button>
				<button class="reports-tab" data-scope="Individual">Individual</button>
			</div>

			<div class="reports-filters scope-all">
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
					<div class="section-title">Featured</div>
					<div class="section-subtitle">Pinned for quick access</div>
				</div>
				<div class="reports-grid featured-reports"></div>
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
	const $tabs = $shell.find(".reports-tab");
	const $featured = $shell.find(".featured-reports");
	const $list = $shell.find(".reports-list");
	const $filters = $shell.find(".reports-filters");
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

	const featured_names = [
		"Performance Analytics",
		"Scorecards by Department",
		"Scorecards by Status",
		"Overdue KPIs"
	];

	function set_scope(scope) {
		state.scope = scope;
		$tabs.removeClass("is-active");
		$tabs.filter(`[data-scope='${scope}']`).addClass("is-active");
		$filters.removeClass("scope-all scope-company scope-department scope-individual")
			.addClass(`scope-${scope.toLowerCase()}`);

		if (scope === "All") {
			controls.department.set_value("");
			controls.employee.set_value("");
		}

		if (scope === "Company") {
			controls.employee.set_value("");
		}

		render_reports_list();
	}

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

	function render_card(report, is_featured) {
		const name = report.report_name || report.name;
		return `
			<div class="report-card ${is_featured ? "report-card--featured" : ""}" data-report="${name}">
				<div class="report-card-title">${name}</div>
				<div class="report-meta">${report.report_type || "Report"} | ${report.ref_doctype || "Performance Scorecard"}</div>
				<div class="report-actions">
					<button class="btn btn-sm btn-primary report-open" data-report="${name}">Open</button>
				</div>
			</div>
		`;
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
		const featured = [];
		const others = [];

		reports.forEach(report => {
			const name = report.report_name || report.name;
			if (featured_names.includes(name)) {
				featured.push(report);
			} else {
				others.push(report);
			}
		});

		$featured.html(featured.length
			? featured.map(r => render_card(r, true)).join("")
			: '<div class="empty-state">No featured reports found.</div>');

		$list.html(others.length
			? others.map(render_list_row).join("")
			: '<div class="empty-state">No reports match your filters.</div>');
	}

	function fetch_reports() {
		$featured.html('<div class="text-muted">Loading...</div>');
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

	$tabs.on("click", function () {
		set_scope($(this).data("scope"));
	});

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
		if (state.scope === "Department" || state.scope === "Individual") {
			controls.employee.set_value("");
		}
		render_reports_list();
	});
	controls.employee.$input.on("change", function () {
		if (state.scope === "Individual") {
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
		}
		render_reports_list();
	});

	set_scope("All");
	fetch_reports();
}

function render_dashboards($container) {
	$container.html(`
		<div class="dashboards-shell">
			<div class="dashboards-tabs">
				<button class="dashboards-tab is-active" data-tab="company">Company</button>
				<button class="dashboards-tab" data-tab="department">Department</button>
				<button class="dashboards-tab" data-tab="employee">Employee</button>
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

	$tabs.on("click", function () {
		const target = $(this).data("tab");
		$tabs.removeClass("is-active");
		$(this).addClass("is-active");
		$panels.removeClass("is-active");
		$panels.filter(`[data-panel="${target}"]`).addClass("is-active");
	});

	frappe.call({
		method: "performance_scorecard.performance_scorecard.page.performance_dashboard.performance_dashboard.get_dashboard_insights",
		callback: function (r) {
			const insights = r.message || {};
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
				args: { level: "Department", department: (insights.meta || {}).department || null },
				callback: function (res) {
					render_department_dashboard($container, insights.department || {}, insights.meta || {}, res.message || {});
				}
			});

			frappe.call({
				method: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.get_strategy_data",
				args: { level: "Individual" },
				callback: function (res) {
					render_employee_dashboard($container, insights.employee || {}, insights.meta || {}, res.message || {});
				}
			});
		}
	});
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
			<div class="dashboard-card metric-card">
				<div class="metric-label">Overall Company Score</div>
				<div class="metric-value">${format_score(avg_score)}</div>
				${render_light(avg_score)}
			</div>
			<div class="dashboard-card metric-card">
				<div class="metric-label">Best Department</div>
				<div class="metric-value">${dept_top ? dept_top.label : "N/A"}</div>
				<div class="metric-sub">${dept_top ? format_score(dept_top.value) : "--"}</div>
			</div>
			<div class="dashboard-card metric-card">
				<div class="metric-label">Bottom Department</div>
				<div class="metric-value">${dept_bottom ? dept_bottom.label : "N/A"}</div>
				<div class="metric-sub">${dept_bottom ? format_score(dept_bottom.value) : "--"}</div>
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
	const goal_items = build_goal_chart_items(goals);
	const kra_items = build_kra_chart_items(goals);
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
	render_chart("#dept-goal-chart", goal_items, "bar");
	render_chart("#dept-kra-chart", kra_items, "bar");
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
				<div class="metric-label">Team Average</div>
				<div class="metric-value">${format_score(data.department_average)}</div>
				${render_light(data.department_average)}
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

function render_chart(target, items, type) {
	const $target = $(target);
	if (!$target.length) {
		return;
	}

	$target.empty();

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

	new frappe.Chart(target, {
		data: {
			labels: labels,
			datasets: [{ values: values }]
		},
		type: type,
		height: 220,
		colors: ["#1AA6A4", "#F46B2A", "#0B2740", "#F4A261"]
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
