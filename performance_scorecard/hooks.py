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
	}
]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/performance_scorecard/css/performance_scorecard.css"
app_include_js = "/assets/performance_scorecard/js/desk_redirect.js"

after_migrate = "performance_scorecard.cleanup.ensure_workspace_routes"

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
	"Goal Master": {
		"after_insert": "performance_scorecard.performance_scorecard.utils.strategy_realtime.publish_from_goal",
		"on_update": "performance_scorecard.performance_scorecard.utils.strategy_realtime.publish_from_goal",
		"on_trash": "performance_scorecard.performance_scorecard.utils.strategy_realtime.publish_from_goal",
	},
	"KRA Master": {
		"after_insert": "performance_scorecard.performance_scorecard.utils.strategy_realtime.publish_from_kra",
		"on_update": "performance_scorecard.performance_scorecard.utils.strategy_realtime.publish_from_kra",
		"on_trash": "performance_scorecard.performance_scorecard.utils.strategy_realtime.publish_from_kra",
	},
	"KPI Master": {
		"after_insert": "performance_scorecard.performance_scorecard.utils.strategy_realtime.publish_from_kpi",
		"on_update": "performance_scorecard.performance_scorecard.utils.strategy_realtime.publish_from_kpi",
		"on_trash": "performance_scorecard.performance_scorecard.utils.strategy_realtime.publish_from_kpi",
	},
	"Performance Scorecard": {
		"on_update": "performance_scorecard.performance_scorecard.utils.strategy_realtime.publish_from_scorecard",
	},
	"Performance Update": {
		"on_update": "performance_scorecard.performance_scorecard.utils.strategy_realtime.publish_from_update",
		"on_submit": "performance_scorecard.performance_scorecard.utils.strategy_realtime.publish_from_update",
	},
}

# Scheduled Tasks
# ------------------
# scheduler_events = {
# 	"all": [
# 		"performance_scorecard.tasks.all"
# 	],
# 	"daily": [
# 		"performance_scorecard.tasks.daily"
# 	],
# 	"hourly": [
# 		"performance_scorecard.tasks.hourly"
# 	],
# 	"weekly": [
# 		"performance_scorecard.tasks.weekly"
# 	],
# 	"monthly": [
# 		"performance_scorecard.tasks.monthly"
# 	],
# }
