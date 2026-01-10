app_name = "performance_scorecard"
app_title = "Performance Center"
app_publisher = "Antigravity"
app_description = "Performance Management App for ERPNext"
app_email = "bot@example.com"
app_license = "MIT"

add_to_apps_screen = [
    {
        "name": "performance_scorecard",
        "logo": "/assets/performance_scorecard/images/performance_scorecard_logo.jpg",
        "title": "Performance Center",
        "route": "/app/performance-dashboard",
    },
    {
        "name": "risk_management",
        "title": "Risk Management",
        "route": "/app/risk-dashboard",
    }
]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
app_include_css = [
    "/assets/performance_scorecard/css/performance_dashboard.css",
    "/assets/performance_scorecard/css/strategy_maps.css",
    "/assets/performance_scorecard/css/risk_heat_map.css"
]
app_include_js = "/assets/performance_scorecard/js/desk_redirect.js"

after_migrate = "performance_scorecard.app.cleanup.ensure_workspace_routes"

# DocTypes
# ------------------
doctype_js = {
    "Appraisal": "public/js/appraisal.js"
}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# DocType Events
# ------------------
doc_events = {
	"Goal": {
		"after_save": "performance_scorecard.app.utils.strategy_realtime.publish_from_goal",
		"on_trash": "performance_scorecard.app.utils.strategy_realtime.publish_from_goal",
	},
	"KRA": {
		"after_save": "performance_scorecard.app.utils.strategy_realtime.publish_from_kra",
		"on_trash": "performance_scorecard.app.utils.strategy_realtime.publish_from_kra",
	},
	"KPI Master": {
		"after_save": "performance_scorecard.app.utils.strategy_realtime.publish_from_kpi",
		"on_trash": "performance_scorecard.app.utils.strategy_realtime.publish_from_kpi",
	},
	"Performance Scorecard": {
		"after_save": "performance_scorecard.app.utils.strategy_realtime.publish_from_scorecard",
	},
	"Performance Update": {
		"after_save": "performance_scorecard.app.utils.strategy_realtime.publish_from_update",
		"on_submit": "performance_scorecard.app.utils.strategy_realtime.publish_from_update",
	},
}
