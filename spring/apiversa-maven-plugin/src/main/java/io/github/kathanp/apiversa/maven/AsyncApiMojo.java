package io.github.kathanp.apiversa.maven;

import java.io.File;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;

/** Writes one AsyncAPI 3.0.0 document per bundle date. */
@Mojo(name = "asyncapi", requiresProject = true)
public class AsyncApiMojo extends AbstractMojo {
    @Parameter(property = "apiversa.dir", defaultValue = "${project.basedir}/api-versions")
    private File dir;

    @Override
    public void execute() throws MojoFailureException {
        try {
            AsyncApi.Result result = AsyncApi.write(dir.toPath());
            if (!result.ok()) throw new MojoFailureException("AV-E001");
            for (java.nio.file.Path file : result.files()) getLog().info("wrote " + file);
        } catch (MojoFailureException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new MojoFailureException(exception.getMessage(), exception);
        }
    }
}
