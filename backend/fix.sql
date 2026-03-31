CREATE TABLE IF NOT EXISTS score_overrides (                                                                                        
    id TEXT PRIMARY KEY,                                                                                                              
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,                                                              
    employee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,                                                                 
    cycle_id TEXT NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,                                                            
    score DOUBLE PRECISION NOT NULL,                                                                                                  
    note TEXT,                                                                                                                        
    created_by TEXT NOT NULL REFERENCES users(id),                                                                                    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),                                                                                      
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),                                                                                      
    UNIQUE(employee_id, cycle_id)                                                                                                     
  );                                                                                                                                  
                                                                                                                                      
  CREATE INDEX IF NOT EXISTS score_overrides_company_id_idx ON score_overrides(company_id);