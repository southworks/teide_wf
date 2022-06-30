const dispatchWorkflow = async (github, context, workflow_id, reference, parameters) => {
  let lastRun = await listWorkflowRuns(github, context, workflow_id)
  let lastRunId = 0
  let currentRunId = 0

  if (lastRun != null) {
    lastRunId = lastRun.id
  }

  await github.rest.actions.createWorkflowDispatch({
    owner: context.repo.owner,
    repo: context.repo.repo,
    workflow_id: workflow_id,
    ref: reference,
    inputs: parameters
  })

  await getCurrentRunId(github, context, workflow_id).then((id) => {
    if (lastRunId != id) {
      currentRunId = id
    }
  })

  return currentRunId
}

const getCurrentRunId = async (github, context, workflow_id) => {
  return new Promise((resolve, reject) => {
    setTimeout(async () => {
      let currentRun = await listWorkflowRuns(github, context, workflow_id)
      if (currentRun != null) {
        resolve(currentRun.id)
      }
      else {
        reject(-1)
      }
    }, 2000)
  })
}

const listWorkflowRuns = async (github, context, workflow_id) => {
  let workflowLog = await github.rest.actions.listWorkflowRuns({
    owner: context.repo.owner,
    repo: context.repo.repo,
    workflow_id: workflow_id,
    per_page: 1
  })

  if (workflowLog.data.total_count > 0) {
    return workflowLog.data.workflow_runs[0]
  }
  else {
    return null
  }
}

const getWorkflowRun = async (github, context, run_id) => {
  let workflowRun = await github.rest.actions.getWorkflowRun({
    owner: context.repo.owner,
    repo: context.repo.repo,
    run_id: run_id
  })

  if (workflowRun.data != null) {
    return workflowRun.data
  }
  else {
    return null
  }
}

const checkStatus = async (github, context, run_id) => {
  let result = await getWorkflowRun(github, context, run_id)
  return new Promise((resolve, reject) => {
    if (result.status != 'completed') {
      reject(result.status)
    }
    else {
      if (result.conclusion != 'success') {
        resolve('Workflow execution failed. For more information go to ' + result.html_url)
      }
      else {
        resolve(result.conclusion)
      }
    }
  })
}

const checkWorkflowStatus = (github, context, core, workflow_id, run_id, delay) => {
  checkStatus(github, context, run_id)
  .then(status => {
    if (status != 'success') {
      core.setFailed(status)
    }
    else {
      console.log(workflow_id + ' was executed successfully')
    }
  })
  .catch(status => {
    if (status != 'completed') {
      console.log(new Date().toISOString() + ' - status: ' + status)
      setTimeout(() => checkWorkflowStatus(github, context, core, workflow_id, run_id, delay), delay)
    }
  })
}

module.exports = {
  dispatchWorkflow,
  checkWorkflowStatus
}
