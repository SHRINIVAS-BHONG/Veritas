import json
import os
import random
import sys

def generate_tricky_dataset(num_cases=100):
    dataset = []
    
    templates = [
        {
            "type": "cost_calculation",
            "question_template": "If I provision a {instance_type} instance for exactly {hours} hours and transfer {data_size}GB of data entirely within {region}, what is my exact total cost?",
            "answer_template": "Your total cost is ${total_cost:.2f}. The {instance_type} instance costs ${hourly_rate:.3f}/hour ({hours} hours = ${total_cost:.2f}), and data transfer within {region} is completely free.",
            "reference_context": "CloudScale Managed Redis databases are priced hourly based on the memory capacity and replication configuration: - Cache-T1 (1GB RAM, Single Node): $0.015/hour (~$11/month) - Cache-M1 (4GB RAM, HA): $0.080/hour - Cache-Production (16GB RAM): $0.320/hour. Network ingress is free, but egress to the public internet is billed at $0.08 per GB. Data transfer within the same CloudScale region is free of charge."
        },
        {
            "type": "role_access",
            "question_template": "I am a '{user_role}' in my organization. Can I invite a new {new_user_title} as a '{target_role}' to check logs, or do I need my 'Admin' to do it?",
            "answer_template": "You {can_invite}. {reasoning}",
            "reference_context": "5. Select a Role: - Owner: Full access, including billing and organization deletion. - Admin: Can manage all resources, settings, and invites, but cannot view billing or delete the organization. - Developer: Can manage applications, databases, and services, but cannot edit organization settings or member roles, nor invite members. - Viewer: Read-only access to all services and logs."
        },
        {
            "type": "domain_constraint",
            "question_template": "How do I configure a custom domain name using the {tier} Tier for my {app_type}?",
            "answer_template": "{answer}",
            "reference_context": "The Free Tier includes 1 app, shared compute, and a cloudscale.io subdomain. To use a custom domain name, SSL certificates, or Auto-Scaling, you must upgrade your organization to the Pro Tier or higher (Enterprise)."
        },
        {
            "type": "failover",
            "question_template": "My {db_type} database failed. Will it automatically failover to a replica with zero downtime?",
            "answer_template": "{answer}",
            "reference_context": "CloudScale Managed PostgreSQL and MySQL take automated daily backups retained for 7 days. If a single-node database fails, CloudScale will automatically attempt crash recovery on a replacement node, incurring downtime. For zero-downtime failover, you must explicitly provision an HA (High Availability) replica. Failover to an HA replica is automatic and typically resolves in under 10 seconds."
        },
        {
            "type": "network_billing",
            "question_template": "Is {traffic_direction} billed at the standard $0.08 per GB rate like {other_direction}?",
            "answer_template": "{answer}",
            "reference_context": "Network ingress is free, but egress to the public internet is billed at $0.08 per GB. Data transfer within the same CloudScale region is free of charge."
        }
    ]

    def generate_cost():
        instances = [("Cache-T1", 0.015), ("Cache-M1", 0.080), ("Cache-Production", 0.320)]
        regions = ["the same CloudScale region", "the local region", "eu-west-1 (same region)"]
        
        inst_name, rate = random.choice(instances)
        hours = random.randint(2, 72)
        data_size = random.randint(10, 500)
        region = random.choice(regions)
        
        total_cost = rate * hours
        
        q = templates[0]["question_template"].format(instance_type=inst_name, hours=hours, data_size=data_size, region=region)
        a = templates[0]["answer_template"].format(total_cost=total_cost, instance_type=inst_name, hourly_rate=rate, hours=hours, region=region)
        return {"question": q, "expected_answer": a, "reference_context": templates[0]["reference_context"]}
        
    def generate_role():
        roles = ["Developer", "Viewer", "Admin", "Owner"]
        titles = ["backend engineer", "data scientist", "frontend dev", "contractor"]
        
        user_role = random.choice(roles)
        target_role = random.choice(["Viewer", "Developer"])
        title = random.choice(titles)
        
        can_invite = "can do it" if user_role in ["Admin", "Owner"] else "need an Admin or Owner to do it"
        if user_role in ["Admin", "Owner"]:
            reasoning = f"{user_role}s have the permission to manage settings and invites."
        else:
            reasoning = f"{user_role}s cannot edit organization settings or member roles, nor can they invite new members."
            
        q = templates[1]["question_template"].format(user_role=user_role, new_user_title=title, target_role=target_role)
        a = templates[1]["answer_template"].format(can_invite=can_invite, reasoning=reasoning)
        return {"question": q, "expected_answer": a, "reference_context": templates[1]["reference_context"]}

    def generate_domain():
        tiers = ["Free", "Pro", "Enterprise"]
        apps = ["React frontend", "Node API", "Python worker", "Static blog"]
        
        tier = random.choice(tiers)
        app = random.choice(apps)
        
        if tier == "Free":
            ans = "You cannot use a custom domain name on the Free Tier. Custom domains require upgrading to at least the Pro tier. The Free Tier only provides a standard shared CloudScale subdomain."
        else:
            ans = f"Since you are on the {tier} Tier, you can configure a custom domain name for your {app} by navigating to your app settings and adding the domain, as {tier} supports custom domains and SSL."
            
        q = templates[2]["question_template"].format(tier=tier, app_type=app)
        return {"question": q, "expected_answer": ans, "reference_context": templates[2]["reference_context"]}

    def generate_failover():
        db_types = ["single-node PostgreSQL", "High Availability (HA) MySQL", "single-node MySQL", "HA PostgreSQL"]
        db_type = random.choice(db_types)
        
        if "single-node" in db_type:
            ans = "No. Single-node dedicated databases do not automatically failover because there is no replica. CloudScale will attempt crash recovery on a replacement node, which incurs downtime."
        else:
            ans = "Yes. Because you have explicitly provisioned an HA (High Availability) replica, failover is automatic and typically resolves in under 10 seconds with near-zero downtime."
            
        q = templates[3]["question_template"].format(db_type=db_type)
        return {"question": q, "expected_answer": ans, "reference_context": templates[3]["reference_context"]}

    def generate_network():
        is_ingress = random.choice([True, False])
        if is_ingress:
            traffic = "public ingress (incoming traffic)"
            other = "public egress"
            ans = "No, network ingress (incoming data) is completely free of charge. Only public egress (outgoing data to the public internet) is billed at $0.08 per GB."
        else:
            traffic = "public egress (outgoing traffic)"
            other = "public ingress"
            ans = "Yes, public egress (outgoing data to the public internet) is billed at $0.08 per GB, unlike network ingress which is free."
            
        q = templates[4]["question_template"].format(traffic_direction=traffic, other_direction=other)
        return {"question": q, "expected_answer": ans, "reference_context": templates[4]["reference_context"]}

    generators = [generate_cost, generate_role, generate_domain, generate_failover, generate_network]
    
    for _ in range(num_cases):
        gen_func = random.choice(generators)
        dataset.append(gen_func())
        
    return dataset

if __name__ == "__main__":
    WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    OUTPUT_PATH = os.path.join(WORKSPACE_DIR, "data", "tricky_set_100.json")
    
    # Ensure stable generation across runs
    random.seed(42)
    
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    
    dataset = generate_tricky_dataset(100)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2)
        
    print(f"Successfully generated {len(dataset)} tricky questions at {OUTPUT_PATH}")
