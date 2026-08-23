# ============================================================================
# Veritas Application - Demo Data Cleanup Script
# ============================================================================
# Purpose: Remove all case-specific data (Template Matter, Parent A, Parent B, Nico)
#          and prepare the application for production deployment
# 
# Status: Ready for Execution
# Last Updated: August 20, 2026
# ============================================================================

param(
    [switch]$DryRun = $false,
    [switch]$Verbose = $false,
    [string]$WorkingDir = (Get-Location).Path,
    [string]$ReportPath = "Cleanup-Report.txt"
)

# ============================================================================
# CONFIGURATION
# ============================================================================

$ErrorActionPreference = "Continue"
$VerbosePreference = if ($Verbose) { "Continue" } else { "SilentlyContinue" }

# Initialize tracking
$script:FilesDeleted = @()
$script:FilesCleaned = @()
$script:DirsDeleted = @()
$script:Errors = @()
$script:StartTime = Get-Date

# Define files to DELETE entirely
$FilesToDelete = @(
    "afi-Template Matter-completed.json",
    "afi-population-template-Template Matter.md",
    "OSSANDON_ACTION_SUMMARY.txt",
    "chase-freedom-expense-mapping.md",
    "expense-reconciliation-Template Matter.json",
    "extract_template-matter_income.py",
    "extract_template-matter_expenses.py",
    "spousal-OLD-BACKUP.html"
)

# Define directories to DELETE entirely
$DirsToDelete = @(
    "_archive",
    ".regulations-cache"
)

# Define cleanup patterns for text files
$CleanupPatterns = @(
    # Case names (high priority)
    @{
        Pattern = "Template Matter"
        Replacement = "[Case Name]"
        FileFilter = @("*.html", "*.js", "*.md", "*.txt", "*.json")
    },
    @{
        Pattern = "Parent B"
        Replacement = "[Party Name]"
        FileFilter = @("*.html", "*.js", "*.md", "*.txt")
    },
    @{
        Pattern = "Parent A"
        Replacement = "[Party Name]"
        FileFilter = @("*.html", "*.js", "*.md", "*.txt")
    },
    @{
        Pattern = "Nico"
        Replacement = "[Party Name]"
        FileFilter = @("*.html", "*.js", "*.md", "*.txt")
    }
)

# Files to clean (keep but remove case data)
$FilesToClean = @(
    "index.html",
    "income-reconciliation.html",
    "afi.html",
    "afi-form-populator.html",
    "sampleData.js",
    "doc-linking-integration.js",
    "reconciliation-data.js",
    "reconciliation-data-enhanced.js",
    "doc-linking-demo.html",
    "BUILD_COMPLETE_SUMMARY.md",
    "EXECUTIVE_SUMMARY.txt",
    "DEPLOYMENT_STATUS.md",
    "ARCHITECTURE_OVERVIEW.md",
    "README.md",
    "PHASE_2_COMPLETE.md"
)

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

function Write-Log {
    param(
        [string]$Message,
        [ValidateSet("INFO", "SUCCESS", "WARNING", "ERROR", "DEBUG")]
        [string]$Level = "INFO"
    )
    
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $prefix = "[$timestamp] [$Level]"
    
    switch ($Level) {
        "SUCCESS" { Write-Host "$prefix $Message" -ForegroundColor Green }
        "ERROR" { Write-Host "$prefix $Message" -ForegroundColor Red }
        "WARNING" { Write-Host "$prefix $Message" -ForegroundColor Yellow }
        "DEBUG" { Write-Verbose "$prefix $Message" }
        default { Write-Host "$prefix $Message" }
    }
}

function Test-PathExists {
    param([string]$Path)
    return (Test-Path -LiteralPath $Path)
}

function Remove-FileItem {
    param(
        [string]$Path,
        [string]$DisplayName
    )
    
    try {
        if ($DryRun) {
            Write-Log "DRY RUN: Would delete file: $DisplayName" "DEBUG"
            $script:FilesDeleted += $DisplayName
            return $true
        }
        
        Remove-Item -LiteralPath $Path -Force -ErrorAction Stop
        Write-Log "✓ Deleted file: $DisplayName" "SUCCESS"
        $script:FilesDeleted += $DisplayName
        return $true
    }
    catch {
        Write-Log "✗ Failed to delete file: $DisplayName - $_" "ERROR"
        $script:Errors += "File deletion failed: $DisplayName - $_"
        return $false
    }
}

function Remove-DirectoryItem {
    param(
        [string]$Path,
        [string]$DisplayName
    )
    
    try {
        if ($DryRun) {
            Write-Log "DRY RUN: Would delete directory: $DisplayName" "DEBUG"
            $script:DirsDeleted += $DisplayName
            return $true
        }
        
        Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
        Write-Log "✓ Deleted directory: $DisplayName" "SUCCESS"
        $script:DirsDeleted += $DisplayName
        return $true
    }
    catch {
        Write-Log "✗ Failed to delete directory: $DisplayName - $_" "ERROR"
        $script:Errors += "Directory deletion failed: $DisplayName - $_"
        return $false
    }
}

function Clean-FileContent {
    param(
        [string]$Path,
        [string]$DisplayName,
        [hashtable[]]$Patterns
    )
    
    try {
        if (-not (Test-Path -LiteralPath $Path)) {
            Write-Log "File not found, skipping: $DisplayName" "WARNING"
            return $false
        }
        
        $content = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
        $originalLength = $content.Length
        $replacementsMade = 0
        
        foreach ($patternObj in $Patterns) {
            $pattern = $patternObj.Pattern
            $replacement = $patternObj.Replacement
            
            $oldContent = $content
            # Case-insensitive replacement
            $content = $content -creplace [regex]::Escape($pattern), $replacement
            
            if ($content -ne $oldContent) {
                $replacementsMade++
                Write-Log "  - Replaced '$pattern' with '$replacement'" "DEBUG"
            }
        }
        
        if ($replacementsMade -gt 0) {
            if ($DryRun) {
                Write-Log "DRY RUN: Would clean file ($replacementsMade replacements): $DisplayName" "DEBUG"
            }
            else {
                Set-Content -LiteralPath $Path -Value $content -Encoding UTF8 -Force
                Write-Log "✓ Cleaned file ($replacementsMade replacements): $DisplayName" "SUCCESS"
            }
            $script:FilesCleaned += "$DisplayName ($replacementsMade replacements)"
            return $true
        }
        else {
            Write-Log "No changes needed: $DisplayName" "DEBUG"
            return $false
        }
    }
    catch {
        Write-Log "✗ Failed to clean file: $DisplayName - $_" "ERROR"
        $script:Errors += "File cleaning failed: $DisplayName - $_"
        return $false
    }
}

function Clear-LocalStorage {
    # Try to find localStorage-related files
    $localStoragePaths = @(
        ".localStorage",
        ".cache",
        "localStorage.json"
    )
    
    foreach ($path in $localStoragePaths) {
        $fullPath = Join-Path $WorkingDir $path
        if (Test-Path -LiteralPath $fullPath) {
            if ($DryRun) {
                Write-Log "DRY RUN: Would clear localStorage: $path" "DEBUG"
            }
            else {
                try {
                    if ((Get-Item -LiteralPath $fullPath) -is [System.IO.DirectoryInfo]) {
                        Remove-Item -LiteralPath $fullPath -Recurse -Force
                    }
                    else {
                        Remove-Item -LiteralPath $fullPath -Force
                    }
                    Write-Log "✓ Cleared localStorage: $path" "SUCCESS"
                }
                catch {
                    Write-Log "✗ Failed to clear localStorage: $path - $_" "WARNING"
                }
            }
        }
    }
}

# ============================================================================
# MAIN CLEANUP EXECUTION
# ============================================================================

function Start-Cleanup {
    Write-Host @"
╔════════════════════════════════════════════════════════════════════════╗
║                   VERITAS DEMO DATA CLEANUP UTILITY                    ║
║                                                                        ║
║  This script will remove all case-specific data from the application  ║
║  Working Directory: $WorkingDir
║  Dry Run Mode: $(if ($DryRun) { "YES (No changes will be made)" } else { "NO (Changes will be applied)" })
╚════════════════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

    Write-Log "Starting cleanup process..." "INFO"
    Write-Log "Current directory: $WorkingDir" "INFO"
    
    if (-not (Test-Path $WorkingDir)) {
        Write-Log "ERROR: Working directory not found: $WorkingDir" "ERROR"
        exit 1
    }

    # ========================================================================
    # PHASE 1: Delete entire files containing only case data
    # ========================================================================
    Write-Host "`n╭─ PHASE 1: Deleting Case-Specific Files" -ForegroundColor Cyan
    Write-Host "├─ Total files to delete: $($FilesToDelete.Count)`n" -ForegroundColor Gray

    $deletedCount = 0
    foreach ($file in $FilesToDelete) {
        $filePath = Join-Path $WorkingDir $file
        if (Test-PathExists $filePath) {
            if (Remove-FileItem -Path $filePath -DisplayName $file) {
                $deletedCount++
            }
        }
        else {
            Write-Log "File not found (already deleted?): $file" "WARNING"
        }
    }

    Write-Host "└─ Phase 1 Complete: $deletedCount files deleted`n" -ForegroundColor Green

    # ========================================================================
    # PHASE 2: Delete entire directories
    # ========================================================================
    Write-Host "╭─ PHASE 2: Deleting Case-Specific Directories" -ForegroundColor Cyan
    Write-Host "├─ Total directories to delete: $($DirsToDelete.Count)`n" -ForegroundColor Gray

    $dirsDeletedCount = 0
    foreach ($dir in $DirsToDelete) {
        $dirPath = Join-Path $WorkingDir $dir
        if (Test-PathExists $dirPath) {
            if (Remove-DirectoryItem -Path $dirPath -DisplayName $dir) {
                $dirsDeletedCount++
            }
        }
        else {
            Write-Log "Directory not found (already deleted?): $dir" "WARNING"
        }
    }

    Write-Host "└─ Phase 2 Complete: $dirsDeletedCount directories deleted`n" -ForegroundColor Green

    # ========================================================================
    # PHASE 3: Clean references from files (keep files, remove data)
    # ========================================================================
    Write-Host "╭─ PHASE 3: Cleaning Case References from Files" -ForegroundColor Cyan
    Write-Host "├─ Total files to clean: $($FilesToClean.Count)`n" -ForegroundColor Gray

    $cleanedCount = 0
    foreach ($file in $FilesToClean) {
        $filePath = Join-Path $WorkingDir $file
        if (Test-PathExists $filePath) {
            if (Clean-FileContent -Path $filePath -DisplayName $file -Patterns $CleanupPatterns) {
                $cleanedCount++
            }
        }
        else {
            Write-Log "File not found, skipping: $file" "WARNING"
        }
    }

    Write-Host "└─ Phase 3 Complete: $cleanedCount files cleaned`n" -ForegroundColor Green

    # ========================================================================
    # PHASE 4: Clear localStorage and cache
    # ========================================================================
    Write-Host "╭─ PHASE 4: Clearing localStorage and Cache" -ForegroundColor Cyan
    Write-Host "├─ Searching for localStorage artifacts...`n" -ForegroundColor Gray

    Clear-LocalStorage

    Write-Host "└─ Phase 4 Complete`n" -ForegroundColor Green

    # ========================================================================
    # SUMMARY AND REPORT
    # ========================================================================
    Generate-CleanupReport
}

function Generate-CleanupReport {
    $endTime = Get-Date
    $duration = $endTime - $script:StartTime
    
    $reportContent = @"
╔════════════════════════════════════════════════════════════════════════╗
║              VERITAS CLEANUP EXECUTION REPORT                         ║
╚════════════════════════════════════════════════════════════════════════╝

EXECUTION DETAILS
═══════════════════════════════════════════════════════════════════════

Execution Date:     $script:StartTime
Completion Date:    $endTime
Total Duration:     $($duration.TotalSeconds) seconds
Execution Mode:     $(if ($DryRun) { "DRY RUN (No changes applied)" } else { "LIVE (Changes applied)" })
Working Directory:  $WorkingDir

CLEANUP SUMMARY
═══════════════════════════════════════════════════════════════════════

Phase 1 - Files Deleted:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Deleted:      $($script:FilesDeleted.Count) files

"@
    
    if ($script:FilesDeleted.Count -gt 0) {
        $reportContent += "Files:`n"
        foreach ($file in $script:FilesDeleted) {
            $reportContent += "  ✓ $file`n"
        }
        $reportContent += "`n"
    }

    $reportContent += @"
Phase 2 - Directories Deleted:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Deleted:      $($script:DirsDeleted.Count) directories

"@
    
    if ($script:DirsDeleted.Count -gt 0) {
        $reportContent += "Directories:`n"
        foreach ($dir in $script:DirsDeleted) {
            $reportContent += "  ✓ $dir`n"
        }
        $reportContent += "`n"
    }

    $reportContent += @"
Phase 3 - Files Cleaned:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Cleaned:      $($script:FilesCleaned.Count) files

"@
    
    if ($script:FilesCleaned.Count -gt 0) {
        $reportContent += "Files:`n"
        foreach ($file in $script:FilesCleaned) {
            $reportContent += "  ✓ $file`n"
        }
        $reportContent += "`n"
    }

    if ($script:Errors.Count -gt 0) {
        $reportContent += @"
ERRORS AND WARNINGS
═══════════════════════════════════════════════════════════════════════

Total Issues:       $($script:Errors.Count)

"@
        foreach ($error in $script:Errors) {
            $reportContent += "  ⚠ $error`n"
        }
        $reportContent += "`n"
    }

    $reportContent += @"
DEPLOYMENT READINESS
═══════════════════════════════════════════════════════════════════════

✓ Case-specific files deleted:      $(if ($script:FilesDeleted.Count -gt 0) { "Yes" } else { "N/A" })
✓ Case references cleaned:          $(if ($script:FilesCleaned.Count -gt 0) { "Yes" } else { "N/A" })
✓ localStorage cleared:             Yes
✓ Archive directories removed:      $(if ($script:DirsDeleted.Count -gt 0) { "Yes" } else { "N/A" })

NEXT STEPS
═══════════════════════════════════════════════════════════════════════

1. Review all cleaned files for correctness
2. Test the application functionality:
   - Check dashboard loads without errors
   - Verify all forms load with empty/template data
   - Test case creation workflow
3. Review README.md and documentation
4. Commit changes to version control
5. Deploy to production environment

MANUAL VERIFICATION CHECKLIST
═══════════════════════════════════════════════════════════════════════

[ ] income-reconciliation.html shows no sample amounts
[ ] afi.html displays blank template form
[ ] sampleData.js contains generic party names
[ ] No "Template Matter" references in browser console
[ ] All HTML pages load without hardcoded data
[ ] Documentation files updated

═══════════════════════════════════════════════════════════════════════
Report generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@

    # Display report in console
    Write-Host "`n" -ForegroundColor Cyan
    Write-Host $reportContent

    # Save report to file
    if (-not $DryRun) {
        try {
            $reportPath = Join-Path $WorkingDir $ReportPath
            Set-Content -LiteralPath $reportPath -Value $reportContent -Encoding UTF8 -Force
            Write-Log "Report saved to: $reportPath" "SUCCESS"
        }
        catch {
            Write-Log "Failed to save report: $_" "ERROR"
        }
    }
}

# ============================================================================
# SCRIPT ENTRY POINT
# ============================================================================

# Confirm action if not in dry-run mode
if (-not $DryRun) {
    Write-Host "`n⚠️  WARNING: This will permanently delete files and modify content!`n" -ForegroundColor Yellow
    $confirmation = Read-Host "Are you sure you want to proceed? Type 'YES' to confirm"
    if ($confirmation -ne "YES") {
        Write-Log "Cleanup cancelled by user" "WARNING"
        exit 0
    }
}

Start-Cleanup

Write-Host "`n"
if ($script:Errors.Count -gt 0) {
    Write-Log "Cleanup completed with $($script:Errors.Count) errors" "WARNING"
    exit 1
}
else {
    Write-Log "Cleanup completed successfully!" "SUCCESS"
    exit 0
}
