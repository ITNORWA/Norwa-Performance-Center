frappe.pages['strategy-plans'].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Strategy Plans',
        single_column: true
    });

    // Add Primary Action
    page.set_primary_action('Create Goal', function () {
        frappe.new_doc('Goal');
    });

    // Add Tabs
    page.main.append(`
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
        <div class="strategy-content">
            <!-- Content will be loaded here -->
        </div>
    `);

    // Bind Tab Clicks
    page.main.find('.nav-link').on('click', function (e) {
        e.preventDefault();
        page.main.find('.nav-link').removeClass('active');
        $(this).addClass('active');
        load_strategy_data(page, $(this).data('level'));
    });

    // Load default tab
    load_strategy_data(page, "Company");
}

function load_strategy_data(page, level) {
    let $content = page.main.find('.strategy-content');
    $content.html('<div class="text-center text-muted">Loading...</div>');

    frappe.call({
        method: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.get_strategy_data",
        args: { level: level },
        callback: function (r) {
            if (r.message) {
                render_strategy_table($content, r.message, level);
            } else {
                $content.html('<div class="text-center text-muted">No strategy defined for this level.</div>');
            }
        }
    });
}

function render_strategy_table($container, data, level) {
    if (!data.length) {
        $container.html('<div class="text-center text-muted">No goals found.</div>');
        return;
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
                        <th style="width: 10%">Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;

    data.forEach(goal => {
        let kras_html = goal.kras.map(k => `
            <div class="kra-item" style="margin-bottom: 5px; padding-bottom: 5px; border-bottom: 1px dashed #eee;">
                <strong>${k.kra_name}</strong> <span class="badge badge-secondary">${k.weightage}%</span>
                <div class="text-muted small">${k.description || ''}</div>
            </div>
        `).join('');

        html += `
            <tr>
                <td>${goal.kpa || '-'}</td>
                <td>
                    <div style="font-weight: bold;">${goal.goal_name}</div>
                    <div class="small text-muted">${goal.start_date} - ${goal.end_date}</div>
                </td>
                <td>${goal.weightage}%</td>
                <td>${kras_html || '<span class="text-muted">No KRAs</span>'}</td>
                <td>
                    <button class="btn btn-xs btn-default btn-edit" data-name="${goal.name}">Edit</button>
                </td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    $container.html(html);

    // Bind Edit Button
    $container.find('.btn-edit').on('click', function () {
        let goal_name = $(this).data('name');
        frappe.set_route('Form', 'Goal', goal_name);
    });
}
