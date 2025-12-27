import frappe
from frappe.model.document import Document
from performance_scorecard.performance_scorecard.scoring_engine import ScoringEngine

class PerformanceUpdate(Document):
    def on_submit(self):
        self.update_scorecard()

    def update_scorecard(self):
        if self.scorecard:
            scorecard = frappe.get_doc("Performance Scorecard", self.scorecard)
            # Find item with this KPI
            kra_name = None
            for item in scorecard.items:
                if item.kpi == self.kpi:
                    item.actual = self.actual_value
                    # Calculate score based on target
                    if item.target:
                        item.score = (item.actual / item.target) * 100 # Simple percentage for now
                    
                    kra_name = item.kra
                    break
            
            scorecard.save()
            scorecard.reload()
            # We don't call calculate_score here because ScoringEngine handles it more comprehensively
            # scorecard.calculate_score() 
            # scorecard.save()
            
            # Trigger Cascading Calculation via Scoring Engine
            if kra_name:
                ScoringEngine.update_kra_progress(kra_name)
