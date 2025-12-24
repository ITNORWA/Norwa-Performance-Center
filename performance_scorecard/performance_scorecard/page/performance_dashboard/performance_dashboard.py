import frappe

@frappe.whitelist()
def get_dashboard_data():
	user = frappe.session.user
	employee = frappe.db.get_value("Employee", {"user_id": user}, "name")
	
	data = {
		"overall_score": 0,
		"kpa_scores": {}
	}

	if employee:
		# Get latest scorecard
		scorecard = frappe.db.get_value("Performance Scorecard", {"employee": employee, "status": "Approved"}, "name", order_by="end_date desc")
		if scorecard:
			doc = frappe.get_doc("Performance Scorecard", scorecard)
			data["overall_score"] = doc.overall_score
			
			# Calculate KPA scores for chart
			# This logic should ideally be stored in the doc or calculated here
			# For now, let's just aggregate items again or store KPA scores in a child table or separate field
			# Re-calculating for display
			kpa_scores = {}
			kpa_counts = {}
			
			for item in doc.items:
				if item.kpa:
					kpa_name = frappe.get_value("KPA Master", item.kpa, "kpa_name")
					if kpa_name not in kpa_scores:
						kpa_scores[kpa_name] = 0
						kpa_counts[kpa_name] = 0
					
					# Simplified KPA score aggregation for dashboard
					# Real logic is in calculate_score but we didn't save KPA scores separately
					# Let's just average item scores for now for visualization
					kpa_scores[kpa_name] += item.score or 0
					kpa_counts[kpa_name] += 1
			
			for kpa in kpa_scores:
				if kpa_counts[kpa] > 0:
					kpa_scores[kpa] = kpa_scores[kpa] / kpa_counts[kpa]
			
			data["kpa_scores"] = kpa_scores

	return data
