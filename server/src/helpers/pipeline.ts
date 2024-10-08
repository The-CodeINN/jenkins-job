import { getRandomPort } from "./getRandomPort";

const escapeXML = (str: string): string => {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const sanitizeName = (name: string): string => {
  return name.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
};

const generatePipeline = (
  imageName: string,
  projectType: "DotNetCore" | "NodeJs",
  envVars: Record<string, string>,
  jobName: string
): string => {
  // Construct the environment variables section for Kubernetes YAML
  let envYaml = "";
  if (envVars) {
    for (const [key, value] of Object.entries(envVars)) {
      envYaml += `
        - name: ${key}
          value: "${value}"
      `;
    }
  }

  const sanitizedProjectType = sanitizeName(projectType);
  const randomPort = getRandomPort();
  const namespace = sanitizeName(jobName);

  // Dynamically generate the deployment.yaml content
  // TODO: Change sanitizedprojecttype-app to jobname-app the job name is the one added by user
  const deploymentYaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${sanitizedProjectType}-app
  namespace: ${namespace}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${sanitizedProjectType}-app
  template:
    metadata:
      labels:
        app: ${sanitizedProjectType}-app
    spec:
      containers:
      - name: ${sanitizedProjectType}-container
        image: ${imageName}
        ports:
        - containerPort: 80
        env: ${envYaml}
  `;

  // Dynamically generate the service.yaml content
  const serviceYaml = `
apiVersion: v1
kind: Service
metadata:
  name: ${sanitizedProjectType}-service
  namespace: ${namespace}
spec:
  selector:
    app: ${sanitizedProjectType}-app
  ports:
    - name: http
      protocol: TCP
      port: 8080
      targetPort: 8080
      nodePort: ${randomPort}
  type: NodePort
`;

  // Escape imageName for XML
  const escapedImageName = escapeXML(imageName);

  // Escape environment variables for XML
  const envVarsScript = Object.keys(envVars)
    .map((key) => {
      return `export ${escapeXML(key)}=${escapeXML(envVars[key])}`;
    })
    .join(" && ");

  const commonPipelineStages = `
    stage('Check Docker Image on Docker Hub') {
      steps {
        script {
          withDockerRegistry(credentialsId: 'docker-cred', toolName: 'docker') {
            def imageExistsOnHub = sh(script: "docker manifest inspect \${IMAGE_NAME}", returnStatus: true)
            if (imageExistsOnHub != 0) {
              error 'Image does not exist on Docker Hub'
            } else {
              echo 'Image exists on Docker Hub'
            }
          }
        }
      }
    }
    stage('Pull Docker Image') {
      steps {
        script {
          withDockerRegistry(credentialsId: 'docker-cred', toolName: 'docker') {
            def imageExistsLocally = sh(script: "docker image inspect \${IMAGE_NAME}", returnStatus: true)
            if (imageExistsLocally != 0) {
              echo 'Image does not exist locally, pulling from Docker Hub'
              sh "docker pull \${IMAGE_NAME}"
            } else {
              echo 'Image already exists locally'
            }
          }
        }
      }
    }

    stage('Docker Image Scan') {
      steps {
        sh "trivy image --format table -o ${jobName}.html \${IMAGE_NAME}"
      }
    }

`.trim();

  const dotNetCorePipeline = `
  stage('Deploy Web App To Kubernetes') {
    steps {
      withCredentials([string(credentialsId: 'my_kubernetes', variable: 'api_token')]) {
        script {
          try {
            sh '''
              set -e
              ${envVarsScript}
              echo 'Creating namespace ${namespace}'
              kubectl --token $api_token --server \${MINIKUBE_URL} --insecure-skip-tls-verify=true create namespace ${namespace} || true
              echo 'Generating dynamic deployment.yaml for Kubernetes'
              cat << EOF > deployment.yaml
${deploymentYaml}
EOF
              echo 'Deployment YAML:'
              cat deployment.yaml

                echo 'Generating dynamic service.yaml for Kubernetes'
                cat << EOF > service.yaml
${serviceYaml}
EOF
                echo 'Service YAML:'
                cat service.yaml

              echo 'Deploying ${imageName} to Minikube'
              kubectl --token $api_token --server \${MINIKUBE_URL} --insecure-skip-tls-verify=true apply -f deployment.yaml
              kubectl --token $api_token --server \${MINIKUBE_URL} --insecure-skip-tls-verify=true apply -f service.yaml
              kubectl --token $api_token --server \${MINIKUBE_URL} --insecure-skip-tls-verify=true wait --for=condition=ready pod -l app=${sanitizedProjectType}-app --timeout=120s -n ${namespace}
              echo 'Deployment completed successfully'

              # Construct the localhost URL
              APP_URL="http://localhost:7080"
              echo "Application URL: $APP_URL"
              
              # Save the URL to a temporary file
              echo "$APP_URL" > /tmp/${namespace}_url.txt

              echo "Starting port forwarding"
              export JENKINS_NODE_COOKIE=dontKillMe
              # Run port forwarding in the background
              bash -c "kubectl --token $api_token --server \${MINIKUBE_URL} --insecure-skip-tls-verify=true port-forward service/${sanitizedProjectType}-service 7080:8080 -n ${namespace} > /tmp/${namespace}_port_forward.log 2>&1 & disown"
              
              # Store the process ID
              echo $! > /tmp/${namespace}_port_forward.pid
              '''
          } catch (Exception e) {
            echo 'Deployment failed: ' + e.message
            sh '''
              echo 'Describing deployment:'
              kubectl --token $api_token --server \${MINIKUBE_URL} --insecure-skip-tls-verify=true describe deployment ${sanitizedProjectType}-app -n ${namespace}
              echo 'Fetching logs:'
              kubectl --token $api_token --server \${MINIKUBE_URL} --insecure-skip-tls-verify=true logs deployment/${sanitizedProjectType}-app -n ${namespace}
            '''
            throw e
          }
        }
      }
    }
  }
`.trim();

  const nodeJsPipeline = `
stage('Deploy Node.js Web App To Kubernetes') {
  steps {
    withCredentials([string(credentialsId: 'my_kubernetes', variable: 'api_token')]) {
      script {
        try {
          sh '''
            set -e
            ${envVarsScript}
            echo 'Creating namespace ${namespace}'
            kubectl --token $api_token --server \${MINIKUBE_URL} --insecure-skip-tls-verify=true create namespace ${namespace} || true
            echo 'Generating dynamic deployment.yaml for Kubernetes'
            cat << EOF > deployment.yaml
${deploymentYaml}
EOF
            echo 'Deployment YAML:'
            cat deployment.yaml

              echo 'Generating dynamic service.yaml for Kubernetes'
              cat << EOF > service.yaml
${serviceYaml}
              echo 'Service YAML:'
              cat service.yaml

            echo 'Deploying ${imageName} to Minikube'
            kubectl --token $api_token --server \${MINIKUBE_URL} --insecure-skip-tls-verify=true apply -f deployment.yaml
            kubectl --token $api_token --server \${MINIKUBE_URL} --insecure-skip-tls-verify=true apply -f service.yaml
            kubectl --token $api_token --server \${MINIKUBE_URL} --insecure-skip-tls-verify=true wait --for=condition=ready pod -l app=${sanitizedProjectType}-app --timeout=120s -n ${namespace}
            echo 'Deployment completed successfully'

            # Construct the localhost URL
            APP_URL="http://localhost:7080"
            echo "Application URL: $APP_URL"
            
            # Save the URL to a temporary file
            echo "$APP_URL" > /tmp/${namespace}_url.txt

            echo "Starting port forwarding"
            export JENKINS_NODE_COOKIE=dontKillMe
            # Run port forwarding in the background
            bash -c "kubectl --token $api_token --server \${MINIKUBE_URL} --insecure-skip-tls-verify=true port-forward service/${sanitizedProjectType}-service 7080:8080 -n ${namespace} > /tmp/${namespace}_port_forward.log 2>&1 & disown"
          
            # Store the process ID
            echo $! > /tmp/${namespace}_port_forward.pid
            '''
        } catch (Exception e) {
          echo 'Deployment failed: ' + e.message
          sh '''
            echo 'Describing deployment:'
            kubectl --token $api_token --server \${MINIKUBE_URL} --insecure-skip-tls-verify=true describe deployment ${sanitizedProjectType}-app -n ${namespace}
            echo 'Fetching logs:'
            kubectl --token $api_token --server \${MINIKUBE_URL} --insecure-skip-tls-verify=true logs deployment/${sanitizedProjectType}-app -n ${namespace}
          '''
          throw e
        }
      }
    }
  }
}
`.trim();

  const projectSpecificPipeline =
    projectType === "DotNetCore" ? dotNetCorePipeline : nodeJsPipeline;

  return `
pipeline {
  agent any
  environment {
    IMAGE_NAME = "${escapedImageName}"
    MINIKUBE_URL = 'http://127.0.0.1:37147'
    KUBECONFIG = '/home/jenkins/.kube/config'
  }
  stages {
    ${commonPipelineStages}
    ${projectSpecificPipeline}
  }

}
  `.trim();
};

export { generatePipeline };
