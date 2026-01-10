import frappe
from frappe.model.document import Document

class RiskRegister(Document):
    def validate(self):
        self.calculate_risk_score()
        self.determine_risk_level()
        self.calculate_residual_risk()
        self.check_appetite_breach()

    def calculate_risk_score(self):
        # Extract numeric values from select fields (e.g., "5 - Severe" -> 5)
        likelihood_val = int(self.likelihood.split(' - ')[0]) if self.likelihood else 0
        impact_val = int(self.impact.split(' - ')[0]) if self.impact else 0
        
        self.risk_score = likelihood_val * impact_val

    def determine_risk_level(self):
        self.risk_level = self.get_risk_level_from_score(self.risk_score)

    def get_risk_level_from_score(self, score):
        if score >= 15:
            return "High"
        elif score >= 6:
            return "Medium"
        else:
            return "Low"

    def calculate_residual_risk(self):
        # Calculate residual risk for each treatment row
        # And determine overall residual risk for the register
        
        overall_res_score = self.risk_score
        
        if self.risk_treatments:
            for row in self.risk_treatments:
                res_l = int(row.residual_likelihood.split(' - ')[0]) if row.residual_likelihood else 0
                res_i = int(row.residual_impact.split(' - ')[0]) if row.residual_impact else 0
                
                row.residual_risk_score = res_l * res_i
                row.residual_risk_level = self.get_risk_level_from_score(row.residual_risk_score)
                
                # Overall residual risk is typically the latest or lowest
                overall_res_score = row.residual_risk_score
        
        self.residual_risk_score = overall_res_score
        self.residual_risk_level = self.get_risk_level_from_score(overall_res_score)

    def check_appetite_breach(self):
        settings = frappe.get_single("Performance Settings")
        
        if not settings.enable_appetite_breaches:
            self.risk_appetite_breach = 0
            self.treatment_required = 0
            return

        context_appetite = None
        if self.risk_context:
            context_appetite = frappe.db.get_value("Risk Context", self.risk_context, "risk_appetite")
        
        if not context_appetite:
            context_appetite = settings.global_risk_appetite or "Medium"
            
        breach = False
        if context_appetite == "Low" and self.residual_risk_level in ["Medium", "High"]:
            breach = True
        elif context_appetite == "Medium" and self.residual_risk_level == "High":
            breach = True
        
        self.risk_appetite_breach = 1 if breach else 0
        self.treatment_required = 1 if breach else 0
