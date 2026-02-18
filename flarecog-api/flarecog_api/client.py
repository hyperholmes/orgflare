"""
FlareCog API Client
==================

Comprehensive Python client for the FlareCog cognitive computing platform.
Provides programmatic access to tenant management, cognitive operations,
MCP integration, and CloudFlare infrastructure.

Based on CloudFlare API patterns from cloudflare_api_demo.py
"""

import os
import json
import time
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import requests


@dataclass
class TenantInfo:
    """Information about a FlareCog tenant"""
    tenant_id: str
    name: str
    tier: str
    status: str
    created_at: int
    worker_url: str
    database_id: str
    kv_namespace_id: str


@dataclass
class CognitiveMetrics:
    """Cognitive operation metrics"""
    total_atoms: int
    total_goals: int
    inferences_made: int
    last_operation: int
    operations_per_minute: float


class FlareCogAPI:
    """
    Comprehensive API client for FlareCog platform.
    
    Provides methods for:
    - Tenant management (create, read, update, delete)
    - Cognitive operations (perceive, reason, plan, learn)
    - MCP server management
    - Metrics and analytics
    - Billing and usage tracking
    """
    
    BASE_URL = "https://api.cloudflare.com/client/v4"
    
    def __init__(
        self,
        api_token: Optional[str] = None,
        account_id: Optional[str] = None,
        platform_url: Optional[str] = None
    ):
        """
        Initialize the FlareCog API client.
        
        Args:
            api_token: CloudFlare API token (or set CLOUDFLARE_API_TOKEN env var)
            account_id: CloudFlare account ID (or set CLOUDFLARE_ACCOUNT_ID env var)
            platform_url: FlareCog platform URL (default: https://platform.flarecog.ai)
        """
        self.api_token = api_token or os.getenv("CLOUDFLARE_API_TOKEN")
        if not self.api_token:
            raise ValueError(
                "API token is required. Set CLOUDFLARE_API_TOKEN environment variable."
            )
        
        self.account_id = account_id or os.getenv("CLOUDFLARE_ACCOUNT_ID")
        if not self.account_id:
            raise ValueError(
                "Account ID is required. Set CLOUDFLARE_ACCOUNT_ID environment variable."
            )
        
        self.platform_url = platform_url or "https://platform.flarecog.ai"
        
        self.headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
    
    def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None,
        raise_on_error: bool = True
    ) -> Optional[Dict]:
        """Make an HTTP request to the CloudFlare API"""
        url = f"{self.BASE_URL}/{endpoint.lstrip('/')}"
        
        try:
            response = requests.request(
                method=method,
                url=url,
                headers=self.headers,
                json=data,
                params=params,
                timeout=30
            )
            response.raise_for_status()
            result = response.json()
            
            if not result.get("success", False):
                errors = result.get("errors", [])
                error_msg = "; ".join([e.get("message", str(e)) for e in errors])
                if raise_on_error:
                    raise Exception(f"API Error: {error_msg}")
                else:
                    return None
            
            return result
        except requests.exceptions.RequestException as e:
            if raise_on_error:
                raise Exception(f"Request failed: {str(e)}")
            else:
                return None
    
    def _make_platform_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None
    ) -> Dict:
        """Make an HTTP request to the FlareCog platform API"""
        url = f"{self.platform_url}/{endpoint.lstrip('/')}"
        
        response = requests.request(
            method=method,
            url=url,
            headers={"Content-Type": "application/json"},
            json=data,
            timeout=30
        )
        response.raise_for_status()
        return response.json()
    
    # ========== Tenant Management ==========
    
    def create_tenant(
        self,
        tenant_id: str,
        name: str,
        tier: str = "free"
    ) -> TenantInfo:
        """
        Create a new FlareCog tenant.
        
        Args:
            tenant_id: Unique tenant identifier (lowercase, alphanumeric, hyphens)
            name: Human-readable tenant name
            tier: Subscription tier (free, pro, enterprise)
        
        Returns:
            TenantInfo object with tenant details
        """
        result = self._make_platform_request(
            "POST",
            "/api/tenants",
            {
                "tenantId": tenant_id,
                "name": name,
                "tier": tier
            }
        )
        
        return TenantInfo(
            tenant_id=result["tenantId"],
            name=result["name"],
            tier=result["tier"],
            status=result["status"],
            created_at=result["createdAt"],
            worker_url=result["workerUrl"],
            database_id=result["databaseId"],
            kv_namespace_id=result["kvNamespaceId"]
        )
    
    def get_tenant(self, tenant_id: str) -> TenantInfo:
        """Get tenant information"""
        result = self._make_platform_request(
            "GET",
            f"/api/tenants/{tenant_id}"
        )
        
        return TenantInfo(**result)
    
    def list_tenants(self) -> List[TenantInfo]:
        """List all tenants"""
        result = self._make_platform_request("GET", "/api/tenants")
        
        return [TenantInfo(**tenant) for tenant in result["tenants"]]
    
    def update_tenant(
        self,
        tenant_id: str,
        name: Optional[str] = None,
        tier: Optional[str] = None,
        status: Optional[str] = None
    ) -> TenantInfo:
        """Update tenant configuration"""
        data = {}
        if name:
            data["name"] = name
        if tier:
            data["tier"] = tier
        if status:
            data["status"] = status
        
        result = self._make_platform_request(
            "PUT",
            f"/api/tenants/{tenant_id}",
            data
        )
        
        return TenantInfo(**result)
    
    def delete_tenant(self, tenant_id: str) -> bool:
        """Delete a tenant"""
        self._make_platform_request(
            "DELETE",
            f"/api/tenants/{tenant_id}"
        )
        return True
    
    # ========== Cognitive Operations ==========
    
    def perceive(self, tenant_id: str, text: str) -> Dict[str, Any]:
        """Extract concepts from text using AI"""
        tenant = self.get_tenant(tenant_id)
        
        response = requests.post(
            f"{tenant.worker_url}/cognitive/perceive",
            json={"text": text},
            timeout=30
        )
        response.raise_for_status()
        return response.json()
    
    def reason(
        self,
        tenant_id: str,
        premises: List[str],
        rule: str = "deduction"
    ) -> Dict[str, Any]:
        """Perform logical reasoning"""
        tenant = self.get_tenant(tenant_id)
        
        response = requests.post(
            f"{tenant.worker_url}/reasoning/infer",
            json={"premises": premises, "rule": rule},
            timeout=30
        )
        response.raise_for_status()
        return response.json()
    
    def query_atomspace(
        self,
        tenant_id: str,
        query: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Query the AtomSpace"""
        tenant = self.get_tenant(tenant_id)
        
        response = requests.post(
            f"{tenant.worker_url}/atomspace/query",
            json=query,
            timeout=30
        )
        response.raise_for_status()
        return response.json()["atoms"]
    
    def create_goal(
        self,
        tenant_id: str,
        description: str,
        priority: int = 5,
        conditions: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Create a cognitive goal"""
        tenant = self.get_tenant(tenant_id)
        
        response = requests.post(
            f"{tenant.worker_url}/mindagent/goals",
            json={
                "description": description,
                "priority": priority,
                "conditions": conditions or []
            },
            timeout=30
        )
        response.raise_for_status()
        return response.json()
    
    # ========== MCP Management ==========
    
    def connect_mcp_server(
        self,
        tenant_id: str,
        server_url: str,
        api_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """Connect tenant to an MCP server"""
        tenant = self.get_tenant(tenant_id)
        
        data = {"serverUrl": server_url}
        if api_key:
            data["authentication"] = {
                "type": "bearer",
                "token": api_key
            }
        
        response = requests.post(
            f"{tenant.worker_url}/mcp/connect",
            json=data,
            timeout=30
        )
        response.raise_for_status()
        return response.json()
    
    def list_mcp_tools(self, tenant_id: str) -> List[Dict[str, Any]]:
        """List available MCP tools for tenant"""
        tenant = self.get_tenant(tenant_id)
        
        response = requests.get(
            f"{tenant.worker_url}/mcp/tools",
            timeout=30
        )
        response.raise_for_status()
        return response.json()["tools"]
    
    def execute_mcp_tool(
        self,
        tenant_id: str,
        server_url: str,
        tool_name: str,
        args: Dict[str, Any]
    ) -> Any:
        """Execute an MCP tool"""
        tenant = self.get_tenant(tenant_id)
        
        response = requests.post(
            f"{tenant.worker_url}/mcp/execute",
            json={
                "serverUrl": server_url,
                "toolName": tool_name,
                "args": args
            },
            timeout=30
        )
        response.raise_for_status()
        return response.json()["result"]
    
    # ========== Metrics & Analytics ==========
    
    def get_tenant_metrics(self, tenant_id: str) -> CognitiveMetrics:
        """Get cognitive metrics for tenant"""
        result = self._make_platform_request(
            "GET",
            f"/api/metrics?tenantId={tenant_id}"
        )
        
        return CognitiveMetrics(**result["metrics"])
    
    def get_platform_stats(self) -> Dict[str, Any]:
        """Get platform-wide statistics"""
        return self._make_platform_request("GET", "/api/stats")
    
    # ========== CloudFlare Infrastructure ==========
    
    def create_d1_database(self, name: str) -> str:
        """Create a D1 database"""
        result = self._make_request(
            "POST",
            f"accounts/{self.account_id}/d1/database",
            {"name": name}
        )
        return result["result"]["uuid"]
    
    def create_kv_namespace(self, title: str) -> str:
        """Create a KV namespace"""
        result = self._make_request(
            "POST",
            f"accounts/{self.account_id}/storage/kv/namespaces",
            {"title": title}
        )
        return result["result"]["id"]
    
    def deploy_worker(
        self,
        script_name: str,
        script_content: str,
        bindings: Optional[List[Dict]] = None
    ) -> bool:
        """Deploy a Worker script"""
        # This would use the CloudFlare SDK for proper deployment
        # Simplified version here
        result = self._make_request(
            "PUT",
            f"accounts/{self.account_id}/workers/scripts/{script_name}",
            {
                "script": script_content,
                "bindings": bindings or []
            }
        )
        return result is not None


def main():
    """Example usage"""
    # Initialize client
    client = FlareCogAPI()
    
    # Create a tenant
    print("Creating tenant...")
    tenant = client.create_tenant(
        tenant_id="demo-tenant",
        name="Demo Tenant",
        tier="pro"
    )
    print(f"Created: {tenant.tenant_id} at {tenant.worker_url}")
    
    # Perform cognitive operation
    print("\nPerceiving text...")
    result = client.perceive(
        tenant.tenant_id,
        "Artificial intelligence is transforming technology"
    )
    print(f"Concepts: {result}")
    
    # Query AtomSpace
    print("\nQuerying AtomSpace...")
    atoms = client.query_atomspace(
        tenant.tenant_id,
        {"type": "ConceptNode"}
    )
    print(f"Found {len(atoms)} concept atoms")
    
    # Get metrics
    print("\nGetting metrics...")
    metrics = client.get_tenant_metrics(tenant.tenant_id)
    print(f"Total atoms: {metrics.total_atoms}")
    print(f"Inferences made: {metrics.inferences_made}")


if __name__ == "__main__":
    main()
