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

    let html = `
	<div class="dashboard-container">
		<!-- Sidebar -->
		<div class="dashboard-sidebar">
			<div class="sidebar-header">
				<h3 style="color:white; margin:0;">Pula Power</h3>
			</div>
			<ul class="sidebar-menu">
				<li class="active"><i class="fa fa-home"></i> Home</li>
				<li><i class="fa fa-list"></i> Strategy Plans</li>
				<li><i class="fa fa-sitemap"></i> Strategy Maps</li>
				<li><i class="fa fa-exclamation-triangle"></i> Risk Management</li>
				<li><i class="fa fa-tachometer"></i> Dashboards</li>
				<li><i class="fa fa-file-text"></i> Reports</li>
				<li><i class="fa fa-cog"></i> Administration</li>
			</ul>
			<div class="user-profile">
				<div class="user-avatar"></div>
				<div>
					<div style="font-weight:bold; font-size:12px;">Pula Power Admin</div>
					<div style="font-size:10px; color:#a0aec0;">Administrator</div>
				</div>
			</div>
		</div>

		<!-- Main Content -->
		<div class="dashboard-main">
			<div class="dashboard-header">
				<div class="page-title">Pula Power</div>
				<div>
					<i class="fa fa-bell" style="font-size:18px; color:#718096; margin-right:15px;"></i>
					<i class="fa fa-user-circle" style="font-size:24px; color:#e53e3e;"></i>
				</div>
			</div>

			<div class="grid-container">
				<!-- Card 1: My Key Objectives -->
				<div class="dashboard-card">
					<div class="card-header blue">MY KEY OBJECTIVES</div>
					<div class="card-content">
						${data.objectives.length ?
            data.objectives.map(o => `<div class="list-item">${o.goal_name} <span class="badge badge-green">${o.status}</span></div>`).join('') :
            '<div class="empty-state">No key objectives assigned.</div>'}
					</div>
				</div>

				<!-- Card 2: My Key Results -->
				<div class="dashboard-card">
					<div class="card-header light-blue">MY KEY RESULTS</div>
					<div class="card-content">
						${data.key_results.length ?
            data.key_results.map(k => `<div class="list-item">${k.kra_name}</div>`).join('') :
            '<div class="empty-state">No key results tracked.</div>'}
					</div>
				</div>

				<!-- Card 3: Needs Attention -->
				<div class="dashboard-card">
					<div class="card-header red">NEEDS ATTENTION (OVERDUE)</div>
					<div class="card-content">
						${data.needs_attention.length ?
            data.needs_attention.map(i => `<div class="list-item">${i.kpi}: ${i.actual}/${i.target}</div>`).join('') :
            '<div class="empty-state">Nothing seems overdue right now.</div>'}
					</div>
				</div>

				<!-- Card 4: My Tasks -->
				<div class="dashboard-card">
					<div class="card-header cyan">MY TASKS</div>
					<div class="card-content">
						${data.tasks.length ?
            data.tasks.map(t => `<div class="list-item">Update ${t.kpi} <span class="badge badge-yellow">${t.status}</span></div>`).join('') :
            '<div class="empty-state">No open tasks assigned.</div>'}
					</div>
				</div>

				<!-- Card 5: KPIs Needing Update -->
				<div class="dashboard-card">
					<div class="card-header yellow">KPIS NEEDING UPDATE</div>
					<div class="card-content">
						${data.kpis_needing_update.length ?
            data.kpis_needing_update.map(k => `<div>${k.name}</div>`).join('') :
            '<div class="empty-state">All your KPIs are up-to-date.</div>'}
					</div>
				</div>

				<!-- Card 6: Recent KPI Updates -->
				<div class="dashboard-card">
					<div class="card-header blue">RECENT KPI UPDATES</div>
					<div class="card-content">
						${data.recent_updates.length ?
            data.recent_updates.map(u => `<div class="list-item">${u.kpi}: ${u.actual_value}</div>`).join('') :
            '<div class="empty-state">No recent updates found for your KPIs.</div>'}
					</div>
				</div>
			</div>
		</div>
	</div>
	`;

    $(page.body).append(html);
}
