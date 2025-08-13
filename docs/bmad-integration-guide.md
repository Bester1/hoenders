# BMad Method Integration Guide - Plaas Hoenders

## 🎯 Integration Status: COMPLETE ✅

The BMad Method v4.35.3 has been fully integrated with the Plaas Hoenders project.

## 🚀 How to Use BMad Method

### Slash Commands (Primary Method)

Try these commands in your Claude Code interface:

```
/BMad pm      # Activate Product Manager
/BMad po      # Activate Product Owner
/BMad sm      # Activate Scrum Master  
/BMad dev     # Activate Developer
/BMad qa      # Activate QA Specialist
/BMad architect # Activate Solution Architect
```

### Alternative: @ Symbol Commands

```
@pm    # Quick Product Manager activation
@po    # Quick Product Owner activation 
@sm    # Quick Scrum Master activation
@dev   # Quick Developer activation
@qa    # Quick QA activation
```

### Manual Activation (Fallback)

If slash commands don't work, use natural language:
- "Please activate as the BMad Scrum Master for Plaas Hoenders"
- "Switch to BMad Product Owner mode"
- "Activate BMad Developer agent"

## 📋 Available Workflows

### 1. Story Creation Workflow
```
/BMad sm          # Activate Scrum Master
*create-story     # Create new story
*review-story     # Review story requirements
```

### 2. Development Workflow
```
/BMad dev         # Activate Developer
*next-story       # Get next story to implement
*validate-story   # Validate implementation
```

### 3. Quality Assurance Workflow
```
/BMad qa          # Activate QA
*review-code      # Review implementation
*test-story       # Test story completion
```

### 4. Product Management Workflow
```
/BMad pm          # Activate Product Manager
*create-prd       # Create/update PRD
*manage-backlog   # Manage product backlog
```

### 5. Architecture Workflow
```
/BMad architect   # Activate Architect
*design-system    # Create system design
*review-arch      # Review architecture
```

## 🎯 Current Project Context

**Project**: Plaas Hoenders Customer Portal Enhancement  
**Type**: Brownfield (existing system enhancement)  
**Epic**: Epic 1 - Customer Order Portal  
**Stories**: 7 stories ready for development  

### Available Stories:
1. Customer Authentication Foundation
2. Customer Portal UI Framework  
3. Product Catalog Display
4. Shopping Cart and Order Placement
5. Order Confirmation and Email Integration
6. Customer Order History and Tracking
7. Customer Profile Management

## 🔧 Configuration Details

### BMad Settings Location:
- **Core Config**: `.bmad-core/core-config.yaml`
- **Claude Settings**: `.claude/settings.local.json`
- **Agent Directory**: `.claude/commands/BMad/agents/`
- **Tasks Directory**: `.claude/commands/BMad/tasks/`

### Integration Features:
- ✅ Slash command prefix: `BMad`
- ✅ All 10 agents available
- ✅ 17 specialized tasks available
- ✅ Brownfield workflow configured
- ✅ Project context loaded
- ✅ Command index created

## 🎭 Available Agents

| Agent | Command | Purpose |
|-------|---------|---------|
| Product Manager | `/BMad pm` | PRD creation, requirements |
| Product Owner | `/BMad po` | Backlog management, validation |
| Scrum Master | `/BMad sm` | Story creation, workflow |
| Developer | `/BMad dev` | Code implementation |
| QA Specialist | `/BMad qa` | Testing, validation |
| Architect | `/BMad architect` | System design |
| Business Analyst | `/BMad analyst` | Research, analysis |
| UX Expert | `/BMad ux-expert` | User experience |
| BMad Master | `/BMad bmad-master` | Framework management |
| Orchestrator | `/BMad bmad-orchestrator` | Workflow coordination |

## 🛠️ Troubleshooting

### If Slash Commands Don't Work:
1. **Check prefix**: Use `/BMad` not just `/`
2. **Try manual activation**: "Activate as BMad Scrum Master"
3. **Restart Claude Code**: Sometimes settings need refresh
4. **Check directory**: Make sure you're in project root

### If Agent Won't Load:
1. **File paths**: Ensure `.bmad-core/` directory exists
2. **Permissions**: Check file access permissions
3. **Manual load**: Ask Claude to read agent file directly

### If Commands Not Recognized:
1. **Check syntax**: Use `*command` format within agents
2. **Help command**: Type `*help` after activating agent
3. **Manual task**: Reference task files directly

## 📚 Next Steps

### To Start Development:
1. **Test activation**: `/BMad sm`
2. **Create story**: `*create-next-story`
3. **Switch to dev**: `/BMad dev`
4. **Implement story**: Follow dev workflow
5. **QA review**: `/BMad qa`

### For Planning Work:
1. **Activate PM**: `/BMad pm`
2. **Review PRD**: `*review-prd`
3. **Create epics**: `*create-epic`
4. **Manage backlog**: `*manage-backlog`

## 🎊 Integration Complete!

The BMad Method is now fully operational on your Plaas Hoenders project. All agents, tasks, and workflows are available and properly configured for your brownfield enhancement project.

**Ready to start development!** 🚀

Try: `/BMad sm` to get started with story creation.